import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, router } from "./_core/trpc.js";
import { condoRouter } from "./routers/condo.js";
import { invitationRouter } from "./routers/invitations.js";
import { profileRouter } from "./routers/profile.js";
import { responsiblesRouter } from "./routers/responsibles.js";
import { setupRouter } from "./routers/setup.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => ({ success: true } as const)),
  }),
  condo: condoRouter,
  invitations: invitationRouter,
  profile: profileRouter,
  responsibles: responsiblesRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
