import type { VercelRequest, VercelResponse } from "@vercel/node";

let handlerPromise: Promise<(req: VercelRequest, res: VercelResponse) => unknown> | null = null;
let initializationStage = "not_started";

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      initializationStage = "express";
      const { default: express } = await import("express");

      initializationStage = "trpc_adapter";
      const { createExpressMiddleware } = await import("@trpc/server/adapters/express");

      initializationStage = "app_router";
      const { appRouter } = await import("../../../server/routers");

      initializationStage = "context";
      const { createContext } = await import("../../../server/_core/context");

      initializationStage = "express_setup";
      const app = express();
      app.use(express.json({ limit: "50mb" }));
      app.use(
        "/api/trpc",
        createExpressMiddleware({
          router: appRouter,
          createContext,
        }),
      );

      initializationStage = "ready";
      return app as unknown as (req: VercelRequest, res: VercelResponse) => unknown;
    })();
  }

  return handlerPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getHandler();
    return app(req, res);
  } catch (error) {
    console.error("[tRPC] Failed to initialize serverless handler:", initializationStage, error);
    res.status(500).json({
      error: "Falha ao inicializar API.",
      stage: initializationStage,
    });
  }
}
