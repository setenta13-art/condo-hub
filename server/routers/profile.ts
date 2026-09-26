import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { condominiums, memberships, organizations, users } from "../../drizzle/schema";
import { getDb, getUserScope } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
    const scope = await getUserScope(ctx.user.id, false);
    if (!scope) return { user: ctx.user, membership: null, condominium: null, organization: null, responsibleUsers: [] };

    const responsibleRows = scope.membership?.unit
      ? await db
          .select({ user: users, membership: memberships })
          .from(memberships)
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(and(
            eq(memberships.condominiumId, scope.condominium.id),
            eq(memberships.unit, scope.membership.unit),
            ...(scope.membership.block ? [eq(memberships.block, scope.membership.block)] : []),
          ))
      : [];

    return {
      user: ctx.user,
      membership: scope.membership,
      condominium: scope.condominium,
      organization: scope.organization,
      responsibleUsers: responsibleRows.map(row => ({ user: row.user, membership: row.membership })),
    };
  }),

  update: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      await db.update(users).set({ name: input.name }).where(eq(users.id, ctx.user.id));
      return { success: true, name: input.name } as const;
    }),
});
