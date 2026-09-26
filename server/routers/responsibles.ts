import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { memberships, users } from "../../drizzle/schema";
import { getDb, getUserScope } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

const membershipRole = z.enum(["resident", "staff", "manager", "admin"]);

async function getManagementScope(user: { id: number; role: string }) {
  const scope = await getUserScope(user.id, user.role === "admin");
  const allowed = user.role === "admin" || ["staff", "manager", "admin"].includes(scope?.membership?.role ?? "");
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas a administração pode gerenciar responsáveis." });
  return scope;
}

export const responsiblesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getManagementScope(ctx.user);
    if (!scope) return [];
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
    const rows = await db
      .select({ membership: memberships, user: users })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.condominiumId, scope.condominium.id))
      .orderBy(asc(memberships.block), asc(memberships.unit), asc(users.name));
    return rows.map(row => ({ ...row.membership, user: row.user }));
  }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int(), role: membershipRole, unit: z.string().trim().max(40).optional(), block: z.string().trim().max(40).optional() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getManagementScope(ctx.user);
      if (!scope) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure um condomínio antes de editar responsáveis." });
      if (input.role === "admin" && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas um administrador da plataforma pode promover este vínculo." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      await db.update(memberships).set({ role: input.role, unit: input.unit || null, block: input.block || null }).where(and(eq(memberships.id, input.id), eq(memberships.condominiumId, scope.condominium.id)));
      return { success: true } as const;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getManagementScope(ctx.user);
      if (!scope) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure um condomínio antes de remover responsáveis." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const membership = await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.id, input.id), eq(memberships.condominiumId, scope.condominium.id))).limit(1);
      if (membership[0]?.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover o próprio acesso." });
      await db.delete(memberships).where(and(eq(memberships.id, input.id), eq(memberships.condominiumId, scope.condominium.id)));
      return { success: true } as const;
    }),
});
