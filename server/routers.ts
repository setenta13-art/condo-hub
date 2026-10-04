import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { condoRouter } from "./routers/condo";
import { invitationRouter } from "./routers/invitations";
import { profileRouter } from "./routers/profile";
import { responsiblesRouter } from "./routers/responsibles";
import { setupRouter } from "./routers/setup";

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
