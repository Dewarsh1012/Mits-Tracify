import { Router } from "express";
import { z } from "zod";
import * as ai from "../controllers/ai.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";

const chainEnum = z.enum(["bitcoin", "ethereum", "tron", "polygon", "bsc", "solana", "arbitrum"]);

const predictBody = z.object({
  chain: chainEnum,
  address: z.string().min(8).max(128),
  maxHops: z.number().int().min(1).max(10).optional(),
  seedValueUsd: z.number().nonnegative().optional(),
  text: z.string().max(4000).optional(),
});

const copilotBody = predictBody.extend({
  question: z.string().min(4).max(2000),
});

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.get("/status", ai.status);
aiRouter.post("/predict-route", validate({ body: predictBody }), ai.predictRoute);
aiRouter.post("/copilot", validate({ body: copilotBody }), ai.copilot);
