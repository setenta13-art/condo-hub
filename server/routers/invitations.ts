import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  acceptInvitationRpc,
  createInvitation,
  getCondominiumById,
  getInvitationByToken,
  getOrganization,
  getUserScope,
  listBlocks,
  listInvitations,
  listUnits,
  revokeInvitation,
} from "../db.js";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.js";

const invitationRole = z.enum(["resident", "staff", "manager"]);

async function getStaffScope(user: { id: number; role: string }) {
  const scope = await getUserScope(user.id, user.role === "admin");
  const allowed =
    user.role === "admin" ||
    ["staff", "manager", "admin"].includes(scope?.membership?.role ?? "");
  if (!scope || !allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas a equipe pode gerenciar convites.",
    });
  }
  return scope;
}

export const invitationRouter = router({
  preview: publicProcedure
    .input(z.object({ token: z.string().min(20).max(96) }))
    .query(async ({ input }) => {
      const invitation = await getInvitationByToken(input.token);
      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este convite não foi encontrado.",
        });
      }

      const condominium = await getCondominiumById(invitation.condominiumId);
      if (!condominium) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Condomínio do convite não encontrado.",
        });
      }

      const organization = await getOrganization(condominium.organizationId);
      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Administradora do convite não encontrada.",
        });
      }

      const expired =
        invitation.status === "pending" &&
        invitation.expiresAt.getTime() <= Date.now();

      return {
        id: invitation.id,
        status: expired ? "expired" : invitation.status,
        role: invitation.role,
        unit: invitation.unit,
        block: invitation.block,
        expiresAt: invitation.expiresAt,
        condominium,
        organization,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getStaffScope(ctx.user);
    const rows = await listInvitations(scope.condominium.id);
    const now = Date.now();

    return rows.map(invitation => ({
      ...invitation,
      status:
        invitation.status === "pending" &&
        invitation.expiresAt.getTime() <= now
          ? "expired"
          : invitation.status,
    }));
  }),

  options: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getStaffScope(ctx.user);
    const [blocks, units] = await Promise.all([
      listBlocks(scope.condominium.id),
      listUnits(scope.condominium.id, true),
    ]);
    return { blocks, units };
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
      const blocks = await listBlocks(scope.condominium.id);
      const units = await listUnits(scope.condominium.id, true);

      let canonicalBlock = input.block?.trim() || null;
      const requestedUnit = input.unit?.trim() || null;

      if (input.role === "resident" && !requestedUnit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe a unidade do morador para concluir o vínculo.",
        });
      }

      let selectedBlock = canonicalBlock
        ? blocks.find(block => block.name === canonicalBlock)
        : undefined;

      if (canonicalBlock && !selectedBlock) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione um bloco cadastrado no condomínio.",
        });
      }

      if (requestedUnit) {
        const matchingUnits = units.filter(unit => unit.identifier === requestedUnit);
        if (!matchingUnits.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selecione uma unidade cadastrada e ativa.",
          });
        }

        if (selectedBlock) {
          if (!matchingUnits.some(unit => unit.blockId === selectedBlock!.id)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "A unidade não pertence ao bloco selecionado.",
            });
          }
        } else if (matchingUnits.length === 1) {
          const unit = matchingUnits[0];
          if (unit.blockId) {
            selectedBlock = blocks.find(block => block.id === unit.blockId);
            canonicalBlock = selectedBlock?.name ?? null;
          }
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Informe o bloco para identificar esta unidade.",
          });
        }
      }

      const token = nanoid(32);
      const expiresAt = new Date(
        Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
      );
      const invitation = await createInvitation({
        condominiumId: scope.condominium.id,
        createdById: ctx.user.id,
        email: input.email?.trim() || null,
        token,
        role: input.role,
        unit: requestedUnit,
        block: canonicalBlock,
        expiresAt,
      });

      return {
        id: invitation.id,
        token,
        expiresAt,
        email: invitation.email,
        condominiumName: scope.condominium.name,
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getStaffScope(ctx.user);
      await revokeInvitation(input.id, scope.condominium.id);
      return { success: true } as const;
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string().min(20).max(96) }))
    .mutation(async ({ ctx, input }) => {
      const result = (await acceptInvitationRpc(
        input.token,
        ctx.user.id,
        ctx.user.email,
      )) as {
        ok?: boolean;
        code?: string;
        message?: string;
        condominiumId?: number | string;
      };

      if (!result?.ok) {
        const code =
          result?.code === "NOT_FOUND"
            ? "NOT_FOUND"
            : result?.code === "EMAIL_MISMATCH"
              ? "FORBIDDEN"
              : result?.code === "CONFLICT"
                ? "CONFLICT"
                : "BAD_REQUEST";

        throw new TRPCError({
          code,
          message: result?.message ?? "Não foi possível aceitar este convite.",
        });
      }

      return {
        success: true,
        condominiumId: Number(result.condominiumId),
      } as const;
    }),
});
