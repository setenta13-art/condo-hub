import { TRPCError } from "@trpc/server";
import {
  getUserById,
  getUserScope,
  listMemberships,
  removeMembership,
  updateMembership,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { z } from "zod";

const membershipRole = z.enum(["resident", "staff", "manager", "admin"]);

async function getManagementScope(user: { id: number; role: string }) {
  const scope = await getUserScope(user.id, user.role === "admin");
  const allowed =
    user.role === "admin" ||
    ["staff", "manager", "admin"].includes(scope?.membership?.role ?? "");
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas a administração pode gerenciar responsáveis.",
    });
  }
  return scope;
}

export const responsiblesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getManagementScope(ctx.user);
    if (!scope) return [];

    const memberships = await listMemberships(scope.condominium.id);
    const rows = [];
    for (const membership of memberships) {
      const user = await getUserById(membership.userId);
      if (user) rows.push({ ...membership, user });
    }

    rows.sort((a, b) =>
      (a.block ?? "").localeCompare(b.block ?? "") ||
      (a.unit ?? "").localeCompare(b.unit ?? "") ||
      (a.user.name ?? "").localeCompare(b.user.name ?? "")
    );
    return rows;
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        role: membershipRole,
        unit: z.string().trim().max(40).optional(),
        block: z.string().trim().max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await getManagementScope(ctx.user);
      if (!scope) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure um condomínio antes de editar responsáveis.",
        });
      }
      if (input.role === "admin" && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas um administrador da plataforma pode promover este vínculo.",
        });
      }

      await updateMembership(input.id, scope.condominium.id, {
        role: input.role,
        unit: input.unit || null,
        block: input.block || null,
      });
      return { success: true } as const;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const scope = await getManagementScope(ctx.user);
      if (!scope) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure um condomínio antes de remover responsáveis.",
        });
      }

      const memberships = await listMemberships(scope.condominium.id);
      const membership = memberships.find(row => row.id === input.id);
      if (membership?.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode remover o próprio acesso.",
        });
      }

      await removeMembership(input.id, scope.condominium.id);
      return { success: true } as const;
    }),
});
