import { GetSignedUploadUrlSchema } from "@marins-room/shared";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { generateSignedUploadUrl } from "../lib/s3.js";
import { requireAdmin } from "../middleware/admin.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";

export const uploadsRouter = Router();

// Admin only - rate limit: 20 uploads per hour
uploadsRouter.use(requireAdmin);
uploadsRouter.use(
  rateLimit({
    limit: 20,
    windowSeconds: 3600,
    keyPrefix: "uploads",
  })
);

/**
 * Get a signed URL for video upload
 * POST /uploads/video/signed-url
 */
uploadsRouter.post(
  "/video/signed-url",
  validateBody(GetSignedUploadUrlSchema),
  async (req, res) => {
    try {
      const { title, description, mimeType, fileSizeBytes } = req.body;

      // Generate unique storage key
      const videoId = uuidv4();
      const extension = mimeType.split("/")[1] || "mp4";
      const storageKey = `videos/${videoId}.${extension}`;

      // Create video record in UPLOADING state
      const video = await prisma.video.create({
        data: {
          id: videoId,
          title,
          description,
          storageKey,
          mimeType,
          fileSizeBytes: BigInt(fileSizeBytes),
          status: "UPLOADING",
        },
      });

      // Generate signed upload URL
      const uploadUrl = await generateSignedUploadUrl(storageKey, mimeType, fileSizeBytes);

      logger.info(`Signed upload URL generated for video ${video.id}`);

      res.json({
        success: true,
        data: {
          uploadUrl,
          storageKey,
          videoId: video.id,
        },
      });
    } catch (error) {
      logger.error("Failed to generate signed upload URL:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "UPLOAD_URL_FAILED",
          message: "Failed to generate upload URL",
        },
      });
    }
  }
);
