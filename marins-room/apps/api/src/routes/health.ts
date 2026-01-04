import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const checks = {
    database: false,
    redis: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    // Database check failed
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    // Redis check failed
  }

  const allHealthy = Object.values(checks).every(Boolean);

  res.status(allHealthy ? 200 : 503).json({
    success: true,
    data: {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
  });
});
