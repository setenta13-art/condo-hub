import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { blocks, condominiums, invitations, memberships, organizations, units } from "../../drizzle/schema.js";
import { getDb, getUserScope } from "../db.js";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.js";

const invitationRole = z.enum(["resident", "staff", "manager"]);

async function getStaffScope(user: { id: number; role: string }) {
  const scope = await getUserScope(user.id, user.role === "admin");
  const allowed = user.role === "admin" || ["staff", "manager", "admin"].includes(scope?.membership?.role ?? "");
  if (!scope || !allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas a equipe pode gerenciar convites." });
  }
  return scope;
}

export const invitationRouter = router({
  preview: publicProcedure
    .input(z.object({ token: z.string().min(20).max(96) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const rows = await db
        .select({
          invitation: invitations,
          condominium: condominiums,
          organization: organizations,
        })
        .from(invitations)
        .innerJoin(condominiums, eq(invitations.condominiumId, condominiums.id))
        .innerJoin(organizations, eq(condominiums.organizationId, organizations.id))
        .where(eq(invitations.token, input.token))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Este convite não foi encontrado." });

      const expired = row.invitation.status === "pending" && row.invitation.expiresAt.getTime() <= Date.now();
      return {
        id: row.invitation.id,
        status: expired ? "expired" : row.invitation.status,
        role: row.invitation.role,
        unit: row.invitation.unit,
        block: row.invitation.block,
        expiresAt: row.invitation.expiresAt,
        condominium: row.condominium,
        organization: row.organization,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getStaffScope(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.condominiumId, scope.condominium.id))
      .orderBy(desc(invitations.createdAt));
    const now = Date.now();
    return rows.map(invitation => ({
      ...invitation,
      status: invitation.status === "pending" && invitation.expiresAt.getTime() <= now ? "expired" : invitation.status,
    }));
  }),

  options: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getStaffScope(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
    const [blockRows, unitRows] = await Promise.all([
      db.select().from(blocks).where(eq(blocks.condominiumId, scope.condominium.id)).orderBy(asc(blocks.name)),
      db.select().from(units).where(and(eq(units.condominiumId, scope.condominium.id), eq(units.status, "active"))).orderBy(asc(units.identifier)),
    ]);
    return { blocks: blockRows, units: unitRows };
  }),

  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email().optional().or(z.literal("")),
        role: invitationRole.default("resident"),
        unit: z.string().max(40).optional(),
        block: z.string().max(40).optional(),
        expiresInDays: z.number().int().min(1).max(30).default(7),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await getStaffScope(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      let canonicalBlock = input.block?.trim() || null;
      const requestedUnit = input.unit?.trim() || null;
      if (input.role === "resident" && !requestedUnit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a unidade do morador para concluir o vínculo." });
      }
      if (canonicalBlock) {
        const block = await db.select().from(blocks).where(and(eq(blocks.condominiumId, scope.condominium.id), eq(blocks.name, canonicalBlock))).limit(1);
        if (!block[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um bloco cadastrado no condomínio." });
        canonicalBlock = block[0].name;
      }
      if (requestedUnit) {
        const unitRows = await db.select().from(units).where(and(eq(units.condominiumId, scope.condominium.id), eq(units.identifier, requestedUnit), eq(units.status, "active")));
        if (!unitRows.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma unidade cadastrada e ativa." });
        if (canonicalBlock) {
          const block = await db.select().from(blocks).where(and(eq(blocks.condominiumId, scope.condominium.id), eq(blocks.name, canonicalBlock))).limit(1);
          if (!block[0] || !unitRows.some(unit => unit.blockId === block[0].id)) throw new TRPCError({ code: "BAD_REQUEST", message: "A unidade não pertence ao bloco selecionado." });
        } else if (unitRows.length === 1 && unitRows[0].blockId) {
          const block = await db.select().from(blocks).where(eq(blocks.id, unitRows[0].blockId)).limit(1);
          canonicalBlock = block[0]?.name ?? null;
        } else if (unitRows.length > 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o bloco para identificar esta unidade." });
        }
      }

      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
      const result = await db.insert(invitations).values({
        condominiumId: scope.condominium.id,
        createdById: ctx.user.id,
        email: input.email || null,
        token,
        role: input.role,
        unit: requestedUnit,
        block: canonicalBlock,
        expiresAt,
      });

      return {
        id: Number(result[0].insertId),
        token,
        expiresAt,
        email: input.email || null,
        condominiumName: scope.condominium.name,
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getStaffScope(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      await db
        .update(invitations)
        .set({ status: "revoked" })
        .where(and(eq(invitations.id, input.id), eq(invitations.condominiumId, scope.condominium.id), eq(invitations.status, "pending")));
      return { success: true } as const;
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string().min(20).max(96) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const rows = await db.select().from(invitations).where(eq(invitations.token, input.token)).limit(1);
      const invitation = rows[0];
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Este convite não foi encontrado." });
      if (invitation.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: invitation.status === "accepted" ? "Este convite já foi utilizado." : "Este convite não está mais disponível." });
      }
      if (invitation.expiresAt.getTime() <= Date.now()) {
        await db.update(invitations).set({ status: "expired" }).where(eq(invitations.id, invitation.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite expirou. Solicite um novo link à administração." });
      }
      if (invitation.email && (!ctx.user.email || invitation.email.toLowerCase() !== ctx.user.email.toLowerCase())) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este convite foi enviado para outro e-mail." });
      }

      await db.transaction(async tx => {
        const claimed = await tx
          .update(invitations)
          .set({ status: "accepted", acceptedById: ctx.user.id, acceptedAt: new Date() })
          .where(and(eq(invitations.id, invitation.id), eq(invitations.status, "pending")));
        if (Number(claimed[0].affectedRows ?? 0) !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "Este convite acabou de ser utilizado. Atualize a página para continuar." });
        }

        const existingMembership = await tx
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.userId, ctx.user.id), eq(memberships.condominiumId, invitation.condominiumId)))
          .limit(1);
        if (!existingMembership[0]) {
          await tx.insert(memberships).values({
            userId: ctx.user.id,
            condominiumId: invitation.condominiumId,
            role: invitation.role,
            unit: invitation.unit,
            block: invitation.block,
          });
        }
      });

      return { success: true, condominiumId: invitation.condominiumId } as const;
    }),
});
