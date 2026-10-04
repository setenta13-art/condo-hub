import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { blocks, condominiums, memberships, organizations, units } from "../../drizzle/schema.js";
import { getDb } from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { z } from "zod";

async function requirePlatformAdmin(user: { role: string }) {
  if (user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o administrador da plataforma pode configurar a estrutura." });
}

async function getCondominium(id: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  const result = await db.select({ condominium: condominiums, organization: organizations }).from(condominiums).innerJoin(organizations, eq(condominiums.organizationId, organizations.id)).where(eq(condominiums.id, id)).limit(1);
  if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Condomínio não encontrado." });
  return { db, ...result[0] };
}

export const setupRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx.user);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
    const [organizationRows, condominiumRows, blockRows, unitRows] = await Promise.all([
      db.select().from(organizations).orderBy(asc(organizations.name)),
      db.select().from(condominiums).orderBy(desc(condominiums.createdAt)),
      db.select().from(blocks).orderBy(asc(blocks.name)),
      db.select().from(units).orderBy(asc(units.identifier)),
    ]);
    return { organizations: organizationRows, condominiums: condominiumRows, blocks: blockRows, units: unitRows };
  }),

  createCondominium: protectedProcedure
    .input(z.object({ organizationName: z.string().trim().min(2).max(160), condominiumName: z.string().trim().min(2).max(160), address: z.string().trim().max(255).optional(), city: z.string().trim().max(120).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const slug = `${input.organizationName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${nanoid(6).toLowerCase()}`;
      await db.insert(organizations).values({ name: input.organizationName, slug });
      const organization = (await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1))[0];
      if (!organization) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a administradora." });
      await db.insert(condominiums).values({ organizationId: organization.id, name: input.condominiumName, address: input.address || null, city: input.city || null, status: "active" });
      const condominium = (await db.select().from(condominiums).where(and(eq(condominiums.organizationId, organization.id), eq(condominiums.name, input.condominiumName))).orderBy(desc(condominiums.createdAt)).limit(1))[0];
      if (!condominium) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o condomínio." });
      const currentMembership = await db.select().from(memberships).where(and(eq(memberships.userId, ctx.user.id), eq(memberships.condominiumId, condominium.id))).limit(1);
      if (!currentMembership[0]) await db.insert(memberships).values({ userId: ctx.user.id, condominiumId: condominium.id, role: "admin" });
      return { success: true, condominiumId: condominium.id } as const;
    }),

  addBlock: protectedProcedure
    .input(z.object({ condominiumId: z.number().int(), name: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      const { db, condominium } = await getCondominium(input.condominiumId);
      const duplicate = await db.select().from(blocks).where(and(eq(blocks.condominiumId, condominium.id), eq(blocks.name, input.name))).limit(1);
      if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "Este bloco já está cadastrado." });
      await db.insert(blocks).values({ condominiumId: condominium.id, name: input.name });
      return { success: true } as const;
    }),

  addUnit: protectedProcedure
    .input(z.object({ condominiumId: z.number().int(), blockId: z.number().int().optional(), identifier: z.string().trim().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      const { db, condominium } = await getCondominium(input.condominiumId);
      if (input.blockId) {
        const block = await db.select().from(blocks).where(and(eq(blocks.id, input.blockId), eq(blocks.condominiumId, condominium.id))).limit(1);
        if (!block[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Bloco inválido para este condomínio." });
      }
      const duplicate = await db.select().from(units).where(and(eq(units.condominiumId, condominium.id), input.blockId ? eq(units.blockId, input.blockId) : isNull(units.blockId), eq(units.identifier, input.identifier))).limit(1);
      if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "Esta unidade já está cadastrada." });
      await db.insert(units).values({ condominiumId: condominium.id, blockId: input.blockId ?? null, identifier: input.identifier, status: "active" });
      return { success: true } as const;
    }),

  setCondominiumStatus: protectedProcedure
    .input(z.object({ condominiumId: z.number().int(), status: z.enum(["active", "inactive"]) }))
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      const { db } = await getCondominium(input.condominiumId);
      await db.update(condominiums).set({ status: input.status }).where(eq(condominiums.id, input.condominiumId));
      return { success: true } as const;
    }),
});
