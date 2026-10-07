import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addTicketMessage,
  archiveAnnouncement,
  assignTicket,
  closeResolvedTickets,
  createAnnouncement,
  createDocument,
  createNotification,
  createTicket,
  createTicketEvent,
  getAnnouncementRead,
  getAnnouncements,
  getDocuments,
  getTicketById,
  getTickets,
  getUnitCount,
  getUserById,
  getUserScope,
  listBlocks,
  listMemberships,
  listNotifications,
  listTicketEvents,
  listTicketMessages,
  listUnits,
  markAllNotificationsRead,
  markAnnouncementRead,
  markNotificationRead,
  updateAnnouncement,
  updateTicketStatus,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";

const categoryAnnouncement = z.enum(["maintenance", "finance", "event", "general"]);
const categoryTicket = z.enum(["maintenance", "security", "cleaning", "billing", "other"]);
const categoryDocument = z.enum(["governance", "rules", "finance", "meeting", "other"]);
const ticketStatus = z.enum(["open", "assigned", "in_progress", "waiting", "resolved", "closed"]);

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

async function ensureResponsible(condominiumId: number, userId: number) {
  const memberships = await listMemberships(condominiumId);
  if (!memberships.some(row => row.userId === userId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione um responsável cadastrado neste condomínio.",
    });
  }
}

async function canAccessTicket(
  user: { id: number; role: string },
  scope: Awaited<ReturnType<typeof resolveScope>>,
  ticketId: number,
) {
  const ticket = await getTicketById(ticketId, scope.condominium.id);
  if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado não encontrado." });
  if (isStaff(scope, user.role)) return ticket;

  const sameUnit =
    Boolean(scope.membership?.unit) &&
    ticket.unit === scope.membership?.unit &&
    (!scope.membership?.block || ticket.block === scope.membership.block);

  if (ticket.openedById !== user.id && !sameUnit) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode acessar este chamado." });
  }
  return ticket;
}

async function enrichedResponsibleOptions(condominiumId: number) {
  const memberships = await listMemberships(condominiumId);
  const byUser = new Map<number, { id: number; name: string | null; email: string | null; contexts: string[] }>();
  for (const membership of memberships) {
    const user = await getUserById(membership.userId);
    if (!user) continue;
    const context = [membership.block, membership.unit ? `Unidade ${membership.unit}` : null]
      .filter(Boolean)
      .join(" · ");
    const current = byUser.get(user.id);
    if (current) {
      if (context && !current.contexts.includes(context)) current.contexts.push(context);
    } else {
      byUser.set(user.id, { id: user.id, name: user.name, email: user.email, contexts: context ? [context] : [] });
    }
  }
  return Array.from(byUser.values()).sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""));
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
          counts: { announcements: 0, tickets: 0, openTickets: 0, documents: 0, units: 0, responsibles: 0 },
        };
      }

      await closeResolvedTickets(scope.condominium.id);
      const staff = isStaff(scope, ctx.user.role);
      const [announcementRows, ticketRows, documentRows, unitCount, memberships] = await Promise.all([
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
        listMemberships(scope.condominium.id),
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
          openTickets: ticketRows.filter(ticket => !["resolved", "closed"].includes(ticket.status)).length,
          documents: documentRows.length,
          units: unitCount,
          responsibles: new Set(memberships.map(row => row.userId)).size,
        },
      };
    }),
  }),

  announcements: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      return getAnnouncements(scope.condominium.id);
    }),

    detail: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        const rows = await getAnnouncements(scope.condominium.id);
        const announcement = rows.find(row => row.id === input.id);
        if (!announcement) throw new TRPCError({ code: "NOT_FOUND", message: "Comunicado não encontrado." });
        return {
          announcement,
          readAt: await getAnnouncementRead(input.id, ctx.user.id),
        };
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

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().min(3).max(200),
        summary: z.string().min(3).max(300),
        body: z.string().min(3),
        category: categoryAnnouncement,
        isPinned: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const scope = await requireStaff(ctx.user, ctx.activeMembershipId);
        await updateAnnouncement(input.id, scope.condominium.id, input);
        return { success: true } as const;
      }),

    archive: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const scope = await requireStaff(ctx.user, ctx.activeMembershipId);
        await archiveAnnouncement(input.id, scope.condominium.id);
        return { success: true } as const;
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        const rows = await getAnnouncements(scope.condominium.id);
        if (!rows.some(row => row.id === input.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comunicado não encontrado." });
        }
        return { readAt: await markAnnouncementRead(input.id, ctx.user.id) };
      }),
  }),

  tickets: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      await closeResolvedTickets(scope.condominium.id);
      return getTickets(
        scope.condominium.id,
        ctx.user.id,
        isStaff(scope, ctx.user.role),
        scope.membership?.block,
        scope.membership?.unit,
      );
    }),

    options: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      const [responsibles, blocks, units] = await Promise.all([
        enrichedResponsibleOptions(scope.condominium.id),
        listBlocks(scope.condominium.id),
        listUnits(scope.condominium.id, true),
      ]);
      return { responsibles, blocks, units, isStaff: isStaff(scope, ctx.user.role) };
    }),

    detail: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        const ticket = await canAccessTicket(ctx.user, scope, input.id);
        const [openedBy, assignedTo, messages, events] = await Promise.all([
          getUserById(ticket.openedById),
          ticket.assignedToId ? getUserById(ticket.assignedToId) : Promise.resolve(undefined),
          listTicketMessages(ticket.id),
          listTicketEvents(ticket.id),
        ]);

        const authorIds = new Set(messages.map(message => message.authorId));
        const authors = new Map<number, Awaited<ReturnType<typeof getUserById>>>();
        for (const id of authorIds) authors.set(id, await getUserById(id));

        const eventActorIds = new Set(events.flatMap(event => [event.actorId, event.assignedToId]).filter((id): id is number => id != null));
        const eventUsers = new Map<number, Awaited<ReturnType<typeof getUserById>>>();
        for (const id of eventActorIds) eventUsers.set(id, await getUserById(id));

        return {
          ticket,
          openedBy: openedBy ? { id: openedBy.id, name: openedBy.name, email: openedBy.email } : null,
          assignedTo: assignedTo ? { id: assignedTo.id, name: assignedTo.name, email: assignedTo.email } : null,
          messages: messages.map(message => ({
            ...message,
            author: authors.get(message.authorId)
              ? {
                  id: authors.get(message.authorId)!.id,
                  name: authors.get(message.authorId)!.name,
                  email: authors.get(message.authorId)!.email,
                }
              : null,
          })),
          events: events.map(event => ({
            ...event,
            actor: event.actorId && eventUsers.get(event.actorId)
              ? { id: eventUsers.get(event.actorId)!.id, name: eventUsers.get(event.actorId)!.name }
              : null,
            assignedTo: event.assignedToId && eventUsers.get(event.assignedToId)
              ? { id: eventUsers.get(event.assignedToId)!.id, name: eventUsers.get(event.assignedToId)!.name }
              : null,
          })),
          isStaff: isStaff(scope, ctx.user.role),
        };
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(3).max(200),
          description: z.string().min(3),
          category: categoryTicket,
          priority: z.enum(["low", "medium", "high"]).default("medium"),
          assignedToId: z.number().int().positive(),
          block: z.string().max(40).optional(),
          unit: z.string().max(40).optional(),
          general: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        await ensureResponsible(scope.condominium.id, input.assignedToId);
        const staff = isStaff(scope, ctx.user.role);

        let block = scope.membership?.block ?? null;
        let unit = scope.membership?.unit ?? null;
        if (staff) {
          block = input.general ? null : input.block?.trim() || null;
          unit = input.general ? null : input.unit?.trim() || null;
        }

        const ticket = await createTicket({
          condominiumId: scope.condominium.id,
          openedById: ctx.user.id,
          assignedToId: input.assignedToId,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          block,
          unit,
        });

        await createTicketEvent({
          ticketId: ticket.id,
          actorId: ctx.user.id,
          eventType: "created",
          toStatus: "assigned",
          assignedToId: input.assignedToId,
          note: "Chamado criado e atribuído.",
        });

        if (input.assignedToId !== ctx.user.id) {
          await createNotification({
            userId: input.assignedToId,
            condominiumId: scope.condominium.id,
            ticketId: ticket.id,
            kind: "ticket_created",
            title: "Novo chamado atribuído a você",
            body: ticket.title,
          });
        }

        return { success: true, ticketId: ticket.id } as const;
      }),

    assign: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), assignedToId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const scope = await requireStaff(ctx.user, ctx.activeMembershipId);
        const ticket = await getTicketById(input.id, scope.condominium.id);
        if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado não encontrado." });
        await ensureResponsible(scope.condominium.id, input.assignedToId);
        await assignTicket(ticket.id, scope.condominium.id, input.assignedToId);
        await createTicketEvent({
          ticketId: ticket.id,
          actorId: ctx.user.id,
          eventType: "assigned",
          fromStatus: ticket.status,
          toStatus: "assigned",
          assignedToId: input.assignedToId,
          note: "Responsável alterado.",
        });
        if (input.assignedToId !== ctx.user.id) {
          await createNotification({
            userId: input.assignedToId,
            condominiumId: scope.condominium.id,
            ticketId: ticket.id,
            kind: "ticket_assigned",
            title: "Chamado atribuído a você",
            body: ticket.title,
          });
        }
        if (ticket.openedById !== ctx.user.id && ticket.openedById !== input.assignedToId) {
          await createNotification({
            userId: ticket.openedById,
            condominiumId: scope.condominium.id,
            ticketId: ticket.id,
            kind: "ticket_assigned",
            title: "Responsável do chamado atualizado",
            body: ticket.title,
          });
        }
        return { success: true } as const;
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: ticketStatus }))
      .mutation(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        const ticket = await canAccessTicket(ctx.user, scope, input.id);
        const staff = isStaff(scope, ctx.user.role);

        if (!staff && input.status !== "open") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Moradores só podem reabrir chamados concluídos ou encerrados." });
        }
        if (!staff && !["resolved", "closed"].includes(ticket.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este chamado ainda está em atendimento." });
        }
        if (staff && input.status === "open") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Use uma etapa de atendimento para atualizar o chamado." });
        }

        await updateTicketStatus(ticket.id, scope.condominium.id, input.status);
        await createTicketEvent({
          ticketId: ticket.id,
          actorId: ctx.user.id,
          eventType: input.status === "open" ? "reopened" : "status_changed",
          fromStatus: ticket.status,
          toStatus: input.status,
          assignedToId: ticket.assignedToId,
        });

        const recipients = new Set<number>([ticket.openedById]);
        if (ticket.assignedToId) recipients.add(ticket.assignedToId);
        recipients.delete(ctx.user.id);
        for (const userId of recipients) {
          await createNotification({
            userId,
            condominiumId: scope.condominium.id,
            ticketId: ticket.id,
            kind: input.status === "open" ? "ticket_reopened" : "ticket_status",
            title: input.status === "open" ? "Chamado reaberto" : "Chamado atualizado",
            body: ticket.title,
          });
        }
        return { success: true } as const;
      }),

    addMessage: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), body: z.string().trim().min(1).max(3000) }))
      .mutation(async ({ ctx, input }) => {
        const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
        const ticket = await canAccessTicket(ctx.user, scope, input.id);
        await addTicketMessage(ticket.id, ctx.user.id, input.body);
        await createTicketEvent({
          ticketId: ticket.id,
          actorId: ctx.user.id,
          eventType: "message",
          assignedToId: ticket.assignedToId,
          note: "Nova mensagem no chamado.",
        });

        const recipients = new Set<number>([ticket.openedById]);
        if (ticket.assignedToId) recipients.add(ticket.assignedToId);
        recipients.delete(ctx.user.id);
        for (const userId of recipients) {
          await createNotification({
            userId,
            condominiumId: scope.condominium.id,
            ticketId: ticket.id,
            kind: "ticket_message",
            title: "Nova mensagem em um chamado",
            body: ticket.title,
          });
        }
        return { success: true } as const;
      }),
  }),

  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      return listNotifications(ctx.user.id, scope.condominium.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      const rows = await listNotifications(ctx.user.id, scope.condominium.id);
      return rows.filter(row => !row.readAt).length;
    }),
    markRead: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationRead(input.id, ctx.user.id);
        return { success: true } as const;
      }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const scope = await resolveScope(ctx.user, ctx.activeMembershipId);
      await markAllNotificationsRead(ctx.user.id, scope.condominium.id);
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
