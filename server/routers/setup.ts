import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import {
  createBlock,
  createCondominium,
  createOrganization,
  createUnit,
  ensureMembership,
  getCondominiumById,
  listAllBlocks,
  listAllUnits,
  listBlocks,
  listCondominiums,
  listOrganizations,
  listUnits,
  setCondominiumStatus,
} from "../db.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { z } from "zod";

async function requirePlatformAdmin(user: { role: string }) {
  if (user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o administrador da plataforma pode configurar a estrutura.",
    });
  }
}

async function requireCondominium(id: number) {
  const condominium = await getCondominiumById(id);
  if (!condominium) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Condomínio não encontrado.",
    });
  }
  return condominium;
}

export const setupRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    await requirePlatformAdmin(ctx.user);
    const [organizations, condominiums, blocks, units] = await Promise.all([
      listOrganizations(),
      listCondominiums(),
      listAllBlocks(),
      listAllUnits(),
    ]);
    return { organizations, condominiums, blocks, units };
  }),

  createCondominium: protectedProcedure
    .input(
      z.object({
        organizationName: z.string().trim().min(2).max(160),
        condominiumName: z.string().trim().min(2).max(160),
        address: z.string().trim().max(255).optional(),
        city: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);

      const slug = `${input.organizationName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}-${nanoid(6).toLowerCase()}`;

      const organization = await createOrganization(input.organizationName, slug);
      const condominium = await createCondominium({
        organizationId: organization.id,
        name: input.condominiumName,
        address: input.address || null,
        city: input.city || null,
      });

      await ensureMembership(ctx.user.id, condominium.id, "admin");
      return { success: true, condominiumId: condominium.id } as const;
    }),

  addBlock: protectedProcedure
    .input(
      z.object({
        condominiumId: z.number().int(),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      const condominium = await requireCondominium(input.condominiumId);
      const blocks = await listBlocks(condominium.id);

      if (blocks.some(block => block.name === input.name)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este bloco já está cadastrado.",
        });
      }

      await createBlock(condominium.id, input.name);
      return { success: true } as const;
    }),

  addUnit: protectedProcedure
    .input(
      z.object({
        condominiumId: z.number().int(),
        blockId: z.number().int().optional(),
        identifier: z.string().trim().min(1).max(40),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      const condominium = await requireCondominium(input.condominiumId);
      const [blocks, units] = await Promise.all([
        listBlocks(condominium.id),
        listUnits(condominium.id),
      ]);

      if (input.blockId && !blocks.some(block => block.id === input.blockId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bloco inválido para este condomínio.",
        });
      }

      const duplicate = units.some(
        unit =>
          unit.identifier === input.identifier &&
          unit.blockId === (input.blockId ?? null),
      );
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta unidade já está cadastrada.",
        });
      }

      await createUnit(
        condominium.id,
        input.blockId ?? null,
        input.identifier,
      );
      return { success: true } as const;
    }),

  setCondominiumStatus: protectedProcedure
    .input(
      z.object({
        condominiumId: z.number().int(),
        status: z.enum(["active", "inactive"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePlatformAdmin(ctx.user);
      await requireCondominium(input.condominiumId);
      await setCondominiumStatus(input.condominiumId, input.status);
      return { success: true } as const;
    }),
});
