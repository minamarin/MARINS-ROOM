import { DonationIdSchema, PaginationSchema } from "@marins-room/shared";
import { Router, type IRouter } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/admin.js";
import { validateParams, validateQuery } from "../middleware/validate.js";

export const donationsRouter: IRouter = Router();

/**
 * Get a single donation by ID (admin only)
 * GET /donations/:id
 */
donationsRouter.get(
  "/:id",
  requireAdmin,
  validateParams(z.object({ id: DonationIdSchema })),
  async (req, res) => {
    const donation = await prisma.donation.findUnique({
      where: { id: req.params.id },
      include: {
        paymentEvents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!donation) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Donation not found",
        },
      });
    }

    res.json({
      success: true,
      data: donation,
    });
  }
);

/**
 * List all donations (admin only)
 * GET /donations
 */
donationsRouter.get("/", requireAdmin, validateQuery(PaginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const skip = (page - 1) * pageSize;

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.donation.count(),
  ]);

  res.json({
    success: true,
    data: {
      items: donations,
      total,
      page,
      pageSize,
      hasMore: skip + donations.length < total,
    },
  });
});
