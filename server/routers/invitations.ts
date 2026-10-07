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
  listPendingInvitationsByEmail,
  listUnits,
  revokeInvitation,
} from "../db.js";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc.js";
import { normalizePhone, sendInviteEmail } from "../_core/inviteDelivery.js";

const invitationRole = z.enum(["resident", "staff", "manager"]);

async function getStaffScope(user: { id: number; role: string }, activeMembershipId?: number | null) {
  const scope = await getUserScope(user.id, user.role === "admin", activeMembershipId);
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
    const scope = await getStaffScope(ctx.user, ctx.activeMembershipId);
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


  pendingForMe: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.email) return [];

    const invitations = await listPendingInvitationsByEmail(ctx.user.email);
    const result = [];

    for (const invitation of invitations) {
      const condominium = await getCondominiumById(invitation.condominiumId);
      if (!condominium) continue;

      const organization = await getOrganization(condominium.organizationId);
      if (!organization) continue;

      result.push({
        token: invitation.token,
        role: invitation.role,
        block: invitation.block,
        unit: invitation.unit,
        expiresAt: invitation.expiresAt,
        condominium: {
          id: condominium.id,
          name: condominium.name,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
      });
    }

    return result;
  }),

  options: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getStaffScope(ctx.user, ctx.activeMembershipId);
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
        phone: z.string().max(30).optional().or(z.literal("")),
        role: invitationRole.default("resident"),
        unit: z.string().max(40).optional(),
        block: z.string().max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await getStaffScope(ctx.user, ctx.activeMembershipId);
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

      const normalizedEmail = input.email?.trim().toLowerCase() || null;
      const rawPhone = input.phone?.trim() || "";
      const normalizedPhone = normalizePhone(rawPhone);

      if (rawPhone && !normalizedPhone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um WhatsApp válido com DDD.",
        });
      }

      if (!normalizedEmail && !normalizedPhone) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe pelo menos um canal de envio: e-mail ou WhatsApp.",
        });
      }

      const currentInvites = await listInvitations(scope.condominium.id);
      const duplicate = currentInvites.find(row =>
        row.status === "pending" &&
        row.expiresAt.getTime() > Date.now() &&
        row.role === input.role &&
        (row.block ?? null) === canonicalBlock &&
        (row.unit ?? null) === requestedUnit &&
        (
          (normalizedEmail && row.email?.trim().toLowerCase() === normalizedEmail) ||
          (normalizedPhone && row.phone === normalizedPhone)
        )
      );
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um convite pendente para este acesso. Use Reenviar para gerar um novo link.",
        });
      }

      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await createInvitation({
        condominiumId: scope.condominium.id,
        createdById: ctx.user.id,
        email: normalizedEmail,
        phone: normalizedPhone,
        token,
        role: input.role,
        unit: requestedUnit,
        block: canonicalBlock,
        expiresAt,
      });

      const headers = (ctx.req as any).headers ?? {};
      const proto = Array.isArray(headers["x-forwarded-proto"]) ? headers["x-forwarded-proto"][0] : headers["x-forwarded-proto"] ?? "https";
      const configuredBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
      const origin = configuredBaseUrl || (headers.host ? `${proto}://${headers.host}` : "");
      const inviteUrl = `${origin}/invite/${token}`;
      const delivery = normalizedEmail
        ? await sendInviteEmail({
            to: normalizedEmail,
            condominiumName: scope.condominium.name,
            inviteUrl,
            expiresAt,
          })
        : { status: "not_requested" as const };

      return {
        id: invitation.id,
        token,
        expiresAt,
        email: invitation.email,
        phone: invitation.phone,
        condominiumName: scope.condominium.name,
        emailDelivery: delivery.status,
      };
    }),

  resend: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getStaffScope(ctx.user, ctx.activeMembershipId);
      const rows = await listInvitations(scope.condominium.id);
      const previous = rows.find(row => row.id === input.id);
      if (!previous || previous.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas convites pendentes podem ser reenviados." });
      }

      await revokeInvitation(previous.id, scope.condominium.id);
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const replacement = await createInvitation({
        condominiumId: scope.condominium.id,
        createdById: ctx.user.id,
        email: previous.email?.trim().toLowerCase() || null,
        phone: previous.phone ?? null,
        token,
        role: previous.role,
        unit: previous.unit,
        block: previous.block,
        expiresAt,
      });

      const headers = (ctx.req as any).headers ?? {};
      const proto = Array.isArray(headers["x-forwarded-proto"]) ? headers["x-forwarded-proto"][0] : headers["x-forwarded-proto"] ?? "https";
      const configuredBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
      const origin = configuredBaseUrl || (headers.host ? `${proto}://${headers.host}` : "");
      const inviteUrl = `${origin}/invite/${token}`;
      const delivery = replacement.email
        ? await sendInviteEmail({
            to: replacement.email,
            condominiumName: scope.condominium.name,
            inviteUrl,
            expiresAt,
          })
        : { status: "not_requested" as const };

      return {
        id: replacement.id,
        token,
        expiresAt,
        email: replacement.email,
        phone: replacement.phone,
        condominiumName: scope.condominium.name,
        emailDelivery: delivery.status,
      };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getStaffScope(ctx.user, ctx.activeMembershipId);
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
        membershipId?: number | string;
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

      const membershipId = Number(result.membershipId);
      if (Number.isInteger(membershipId) && membershipId > 0) {
        ctx.res.setHeader(
          "Set-Cookie",
          `condohub-membership=${membershipId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
        );
      }
      return {
        success: true,
        condominiumId: Number(result.condominiumId),
        membershipId,
      } as const;
    }),
});
