import type { VercelRequest, VercelResponse } from "@vercel/node";

let handlerPromise: Promise<(req: VercelRequest, res: VercelResponse) => unknown> | null = null;

async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const [{ default: express }, { createExpressMiddleware }, { appRouter }, { createContext }] =
        await Promise.all([
          import("express"),
          import("@trpc/server/adapters/express"),
          import("../../../server/routers"),
          import("../../../server/_core/context"),
        ]);

      const app = express();
      app.use(express.json({ limit: "50mb" }));
      app.use(
        "/api/trpc",
        createExpressMiddleware({
          router: appRouter,
          createContext,
        }),
      );

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
    console.error("[tRPC] Failed to initialize serverless handler:", error);
    res.status(500).json({ error: "Falha ao inicializar API." });
  }
}
