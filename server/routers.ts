import { systemRouter } from "./_core/systemRouter.js";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { listUserScopes } from "./db.js";
import { z } from "zod";
import { condoRouter } from "./routers/condo.js";
import { invitationRouter } from "./routers/invitations.js";
import { profileRouter } from "./routers/profile.js";
import { responsiblesRouter } from "./routers/responsibles.js";
import { setupRouter } from "./routers/setup.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    contexts: protectedProcedure.query(async ({ ctx }) => {
      const scopes = await listUserScopes(ctx.user.id);
      return scopes.map((scope, index) => ({
        membership: scope.membership,
        condominium: scope.condominium,
        organization: scope.organization,
        active: scope.membership.id === ctx.activeMembershipId ||
          (!ctx.activeMembershipId && index === 0),
      }));
    }),
    switchContext: protectedProcedure
      .input(z.object({ membershipId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const scopes = await listUserScopes(ctx.user.id);
        const selected = scopes.find(scope => scope.membership.id === input.membershipId);
        if (!selected) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vínculo não encontrado para este usuário." });
        }
        ctx.res.setHeader(
          "Set-Cookie",
          `condohub-membership=${input.membershipId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
        );
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
  condo: condoRouter,
  invitations: invitationRouter,
  profile: profileRouter,
  responsibles: responsiblesRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
