import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAnnouncement,
  createDocument,
  createTicket,
  getAnnouncements,
  getDocuments,
  getTickets,
  getUnitCount,
  getUserScope,
  updateTicketStatus,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

const categoryAnnouncement = z.enum(["maintenance", "finance", "event", "general"]);
const categoryTicket = z.enum(["maintenance", "security", "cleaning", "billing", "other"]);
const categoryDocument = z.enum(["governance", "rules", "finance", "meeting", "other"]);

async function resolveScope(user: { id: number; role: string }, activeMembershipId?: number | null) {
  const scope = await getUserScope(user.id, user.role === "admin", activeMembershipId);
  if (!scope) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Seu usuário ainda não está vinculado a um condomínio.",
    });
  }
  return scope;
}

function isStaff(scope: { membership?: { role: string } }, platformRole: string) {
  return platformRole === "admin" || ["staff", "manager", "admin"].includes(scope.membership?.role ?? "");
}

async function requireStaff(user: { id: number; role: string }, activeMembershipId?: number | null) {
  const scope = await resolveScope(user, activeMembershipId);
  if (!isStaff(scope, user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe do condomínio." });
  }
  return scope;
}

export const condoRouter = router({
  dashboard: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getUserScope(ctx.user.id, ctx.user.role === "admin", ctx.activeMembershipId);
      if (!scope) {
        return {
          scope: null,
          announcements: [],
          tickets: [],
          documents: [],
          counts: { announcements: 0, tickets: 0, openTickets: 0, documents: 0, units: 0 },
        };
      }

      const staff = isStaff(scope, ctx.user.role);
      const [announcementRows, ticketRows, documentRows, unitCount] = await Promise.all([
        getAnnouncements(scope.condominium.id),
        getTickets(
          scope.condominium.id,
          ctx.user.id,
          staff,
          scope.membership?.block,
          scope.membership?.unit,
        ),
        getDocuments(scope.condominium.id),
        getUnitCount(scope.condominium.id),
      ]);

      return {
        scope: {
          condominium: scope.condominium,
          organization: scope.organization,
          membership: scope.membership,
          isStaff: staff,
        },
        announcements: announcementRows.slice(0, 4),
        tickets: ticketRows.slice(0, 5),
        documents: documentRows.slice(0, 5),
        counts: {
          announcements: announcementRows.length,
          tickets: ticketRows.length,
          openTickets: ticketRows.filter(ticket => ticket.status !== "resolved").length,
          documents: documentRows.length,
          units: unitCount,
        },
      };
    }),
  }),

  announcements: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      return getAnnouncements(scope.condominium.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(3).max(200),
          summary: z.string().min(3).max(300),
          body: z.string().min(3),
          category: categoryAnnouncement,
          isPinned: z.boolean().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const scope = await requireStaff(ctx.user, ctx.activeMembershipId);
        await createAnnouncement({
          condominiumId: scope.condominium.id,
          authorId: ctx.user.id,
          title: input.title,
          summary: input.summary,
          body: input.body,
          category: input.category,
          isPinned: input.isPinned,
        });
        return { success: true } as const;
      }),
  }),

  tickets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      return getTickets(
        scope.condominium.id,
        ctx.user.id,
        isStaff(scope, ctx.user.role),
        scope.membership?.block,
        scope.membership?.unit,
      );
    }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(3).max(200),
          description: z.string().min(3),
          category: categoryTicket,
          priority: z.enum(["low", "medium", "high"]).default("medium"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        await createTicket({
          condominiumId: scope.condominium.id,
          openedById: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          block: scope.membership?.block ?? null,
          unit: scope.membership?.unit ?? null,
        });
        return { success: true } as const;
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number().int(), status: z.enum(["open", "in_progress", "resolved"]) }))
      .mutation(async ({ ctx, input }) => {
        const scope = await requireStaff(ctx.user, ctx.activeMembershipId);
        await updateTicketStatus(input.id, scope.condominium.id, input.status);
        return { success: true } as const;
      }),
  }),

  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      return getDocuments(scope.condominium.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(3).max(200),
          description: z.string().max(300).optional(),
          category: categoryDocument,
          fileUrl: z.string().url(),
          fileKey: z.string().min(1).max(255),
          mimeType: z.string().max(120).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const scope = await requireStaff(ctx.user, ctx.activeMembershipId);
        await createDocument({
          condominiumId: scope.condominium.id,
          uploadedById: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          mimeType: input.mimeType,
        });
        return { success: true } as const;
      }),
  }),
});
