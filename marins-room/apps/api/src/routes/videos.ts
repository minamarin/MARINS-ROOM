import { PaginationSchema, UpdateVideoStatusSchema, VideoIdSchema } from "@marins-room/shared";
import { Router, type IRouter } from "express";
import { z } from "zod";

import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { getPublicUrl } from "../lib/s3.js";
import { requireAdmin } from "../middleware/admin.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";

export const videosRouter: IRouter = Router();

/**
 * List all videos (public - only READY videos)
 * GET /videos
 */
videosRouter.get("/", validateQuery(PaginationSchema), async (req, res) => {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const skip = (page - 1) * pageSize;

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where: { status: "READY" },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        playbackUrl: true,
        thumbnailUrl: true,
        durationSeconds: true,
        createdAt: true,
      },
    }),
    prisma.video.count({ where: { status: "READY" } }),
  ]);

  res.json({
    success: true,
    data: {
      items: videos,
      total,
      page,
      pageSize,
      hasMore: skip + videos.length < total,
    },
  });
});

/**
 * Get a single video by ID (public for READY, admin for all)
 * GET /videos/:id
 */
videosRouter.get("/:id", validateParams(z.object({ id: VideoIdSchema })), async (req, res) => {
  const isAdmin = req.headers["x-admin-api-key"] !== undefined;

  const video = await prisma.video.findUnique({
    where: { id: req.params.id },
  });

  if (!video) {
    return res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Video not found",
      },
    });
  }

  // Non-admin can only see READY videos
  if (!isAdmin && video.status !== "READY") {
    return res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Video not found",
      },
    });
  }

  res.json({
    success: true,
    data: {
      ...video,
      fileSizeBytes: video.fileSizeBytes ? Number(video.fileSizeBytes) : null,
    },
  });
});

/**
 * Update video status (admin only)
 * PATCH /videos/:id/status
 */
videosRouter.patch(
  "/:id/status",
  requireAdmin,
  validateParams(z.object({ id: VideoIdSchema })),
  validateBody(UpdateVideoStatusSchema),
  async (req, res) => {
    const { status, playbackUrl, error } = req.body;

    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Video not found",
        },
      });
    }

    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: {
        status,
        playbackUrl,
        errorMessage: error,
      },
    });

    logger.info(`Video ${video.id} status updated to ${status}`);

    res.json({
      success: true,
      data: {
        ...updated,
        fileSizeBytes: updated.fileSizeBytes ? Number(updated.fileSizeBytes) : null,
      },
    });
  }
);

/**
 * Confirm video upload completed (admin only)
 * POST /videos/:id/confirm-upload
 */
videosRouter.post(
  "/:id/confirm-upload",
  requireAdmin,
  validateParams(z.object({ id: VideoIdSchema })),
  async (req, res) => {
    const video = await prisma.video.findUnique({
      where: { id: req.params.id },
    });

    if (!video) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Video not found",
        },
      });
    }

    if (video.status !== "UPLOADING") {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "Video is not in UPLOADING status",
        },
      });
    }

    // Generate playback URL from storage key
    const playbackUrl = getPublicUrl(video.storageKey);

    // For MVP, skip processing and mark as READY
    // TODO: In production, mark as PROCESSING and trigger worker
    const updated = await prisma.video.update({
      where: { id: req.params.id },
      data: {
        status: "READY",
        playbackUrl,
      },
    });

    logger.info(`Video ${video.id} upload confirmed, marked as READY`);

    res.json({
      success: true,
      data: {
        ...updated,
        fileSizeBytes: updated.fileSizeBytes ? Number(updated.fileSizeBytes) : null,
      },
    });
  }
);
