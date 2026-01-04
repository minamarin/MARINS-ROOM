import "dotenv/config";

import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

// ============================================
// Job Queues
// ============================================

export const videoProcessingQueue = new Queue("video-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const emailQueue = new Queue("email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

// ============================================
// Video Processing Worker
// ============================================

const videoWorker = new Worker(
  "video-processing",
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing video job");

    // TODO: Implement video processing logic
    // This could include:
    // 1. Download video from S3
    // 2. Transcode to different qualities (using ffmpeg)
    // 3. Generate thumbnails
    // 4. Upload processed files back to S3
    // 5. Update video record in database

    switch (job.name) {
      case "transcode":
        await handleTranscode(job.data);
        break;
      case "generate-thumbnail":
        await handleGenerateThumbnail(job.data);
        break;
      default:
        logger.warn({ jobName: job.name }, "Unknown video job type");
    }
  },
  { connection }
);

async function handleTranscode(data: { videoId: string; storageKey: string }) {
  logger.info({ videoId: data.videoId }, "Transcoding video (stub)");

  // TODO: Implement actual transcoding
  // For now, just simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 1000));

  logger.info({ videoId: data.videoId }, "Video transcoding complete (stub)");
}

async function handleGenerateThumbnail(data: { videoId: string; storageKey: string }) {
  logger.info({ videoId: data.videoId }, "Generating thumbnail (stub)");

  // TODO: Implement actual thumbnail generation
  await new Promise((resolve) => setTimeout(resolve, 500));

  logger.info({ videoId: data.videoId }, "Thumbnail generation complete (stub)");
}

videoWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Video job completed");
});

videoWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Video job failed");
});

// ============================================
// Email Worker
// ============================================

const emailWorker = new Worker(
  "email",
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "Processing email job");

    // TODO: Implement email sending logic
    // This could use nodemailer, sendgrid, etc.

    switch (job.name) {
      case "donation-thank-you":
        await handleDonationThankYou(job.data);
        break;
      case "welcome":
        await handleWelcomeEmail(job.data);
        break;
      default:
        logger.warn({ jobName: job.name }, "Unknown email job type");
    }
  },
  { connection }
);

async function handleDonationThankYou(data: { email: string; name: string; amount: number }) {
  logger.info({ email: data.email }, "Sending donation thank you email (stub)");

  // TODO: Implement actual email sending
  await new Promise((resolve) => setTimeout(resolve, 200));

  logger.info({ email: data.email }, "Donation thank you email sent (stub)");
}

async function handleWelcomeEmail(data: { email: string; name: string }) {
  logger.info({ email: data.email }, "Sending welcome email (stub)");

  // TODO: Implement actual email sending
  await new Promise((resolve) => setTimeout(resolve, 200));

  logger.info({ email: data.email }, "Welcome email sent (stub)");
}

emailWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Email job completed");
});

emailWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, "Email job failed");
});

// ============================================
// Startup
// ============================================

logger.info("Worker started");
logger.info("Listening for jobs on queues: video-processing, email");

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down workers...");

  await videoWorker.close();
  await emailWorker.close();
  await videoProcessingQueue.close();
  await emailQueue.close();
  await connection.quit();

  logger.info("Workers shut down successfully");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
