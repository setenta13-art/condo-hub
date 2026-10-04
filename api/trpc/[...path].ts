import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../../server/routers.js";
import { createServerlessContext } from "../_lib/context.js";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: createServerlessContext,
  }),
);

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
