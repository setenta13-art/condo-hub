import { protectedProcedure, router } from "../_core/trpc.js";
import {
  getUserById,
  getUserScope,
  listMemberships,
  updateUserName,
} from "../db.js";
import { z } from "zod";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getUserScope(ctx.user.id, false, ctx.activeMembershipId);
    if (!scope) {
      return {
        user: ctx.user,
        membership: null,
        condominium: null,
        organization: null,
        responsibleUsers: [],
      };
    }

    const responsibleUsers = [];
    if (scope.membership?.unit) {
      const memberships = await listMemberships(scope.condominium.id);
      const sameUnit = memberships.filter(membership =>
        membership.unit === scope.membership!.unit &&
        (!scope.membership!.block || membership.block === scope.membership!.block)
      );

      for (const membership of sameUnit) {
        const user = await getUserById(membership.userId);
        if (user) responsibleUsers.push({ user, membership });
      }
    }

    return {
      user: ctx.user,
      membership: scope.membership,
      condominium: scope.condominium,
      organization: scope.organization,
      responsibleUsers,
    };
  }),

  update: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await updateUserName(ctx.user.id, input.name);
      return { success: true, name: input.name } as const;
    }),
});
