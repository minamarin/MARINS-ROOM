import {
  PaginationSchema,
  SendMessageSchema,
  SessionIdSchema,
  StartChatSessionSchema,
} from "@marins-room/shared";
import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { getAIResponse } from "../lib/ai.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/admin.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";

export const chatRouter: IRouter = Router();

/**
 * Start a new chat session
 * POST /chat/sessions
 */
chatRouter.post(
  "/sessions",
  rateLimit({
    limit: 5,
    windowSeconds: 60,
    keyPrefix: "chat-start",
  }),
  validateBody(StartChatSessionSchema),
  async (req, res) => {
    try {
      const { visitorName } = req.body;
      const visitorId = req.ip || uuidv4();

      const session = await prisma.chatSession.create({
        data: {
          visitorId,
          visitorName,
          status: "ACTIVE",
        },
      });

      // Add welcome message
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "ASSISTANT",
          content:
            "Hi there! Welcome to Marin's Room. I'm an AI assistant here to help you. How can I assist you today?",
        },
      });

      logger.info(`Chat session started: ${session.id}`);

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          session,
        },
      });
    } catch (error) {
      logger.error("Failed to start chat session:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SESSION_START_FAILED",
          message: "Failed to start chat session",
        },
      });
    }
  }
);

/**
 * Send a message in a chat session
 * POST /chat/messages
 */
chatRouter.post(
  "/messages",
  rateLimit({
    limit: 30,
    windowSeconds: 60,
    keyPrefix: "chat-message",
  }),
  validateBody(SendMessageSchema),
  async (req, res) => {
    try {
      const { sessionId, content } = req.body;

      // Verify session exists and is active
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: "SESSION_NOT_FOUND",
            message: "Chat session not found",
          },
        });
      }

      if (session.status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          error: {
            code: "SESSION_CLOSED",
            message: "This chat session has been closed",
          },
        });
      }

      // Save user message
      const userMessage = await prisma.chatMessage.create({
        data: {
          sessionId,
          role: "USER",
          content,
        },
      });

      // Get conversation history for AI context
      const history = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        take: 20, // Last 20 messages for context
      });

      // Get AI response
      const aiResult = await getAIResponse(
        history.map((m) => ({
          role: m.role.toLowerCase() as "user" | "assistant" | "system",
          content: m.content,
        }))
      );

      let aiMessage = null;
      if (aiResult.content) {
        aiMessage = await prisma.chatMessage.create({
          data: {
            sessionId,
            role: "ASSISTANT",
            content: aiResult.content,
          },
        });
      }

      // Update session timestamp
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      res.json({
        success: true,
        data: {
          message: userMessage,
          aiResponse: aiMessage,
        },
      });
    } catch (error) {
      logger.error("Failed to send message:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "MESSAGE_SEND_FAILED",
          message: "Failed to send message",
        },
      });
    }
  }
);

/**
 * List chat sessions (admin only)
 * GET /chat/sessions
 */
chatRouter.get(
  "/sessions",
  requireAdmin,
  validateQuery(PaginationSchema),
  async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const skip = (page - 1) * pageSize;

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        skip,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      }),
      prisma.chatSession.count(),
    ]);

    res.json({
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          ...s,
          messageCount: s._count.messages,
        })),
        total,
      },
    });
  }
);

/**
 * Get messages for a session
 * GET /chat/sessions/:sessionId/messages
 */
chatRouter.get(
  "/sessions/:sessionId/messages",
  validateParams(z.object({ sessionId: SessionIdSchema })),
  async (req, res) => {
    const isAdmin = req.headers["x-admin-api-key"] !== undefined;
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Chat session not found",
        },
      });
    }

    // Only admin can view other visitors' sessions
    const visitorId = req.ip || "";
    if (!isAdmin && session.visitorId !== visitorId) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You can only view your own chat sessions",
        },
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      success: true,
      data: {
        session,
        messages,
      },
    });
  }
);

/**
 * Close a chat session (admin only)
 * POST /chat/sessions/:sessionId/close
 */
chatRouter.post(
  "/sessions/:sessionId/close",
  requireAdmin,
  validateParams(z.object({ sessionId: SessionIdSchema })),
  async (req, res) => {
    const { sessionId } = req.params;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Chat session not found",
        },
      });
    }

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED" },
    });

    logger.info(`Chat session ${sessionId} closed`);

    res.json({
      success: true,
      data: null,
    });
  }
);

/**
 * Admin reply to a session
 * POST /chat/sessions/:sessionId/reply
 */
chatRouter.post(
  "/sessions/:sessionId/reply",
  requireAdmin,
  validateParams(z.object({ sessionId: SessionIdSchema })),
  validateBody(z.object({ content: z.string().min(1).max(4000) })),
  async (req, res) => {
    const { sessionId } = req.params;
    const { content } = req.body;

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Chat session not found",
        },
      });
    }

    // Admin messages are marked as ASSISTANT for simplicity
    // In production, you might want a separate ADMIN role
    const message = await prisma.chatMessage.create({
      data: {
        sessionId: sessionId!,
        role: "ASSISTANT",
        content: `[Marin]: ${content}`,
      },
    });

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    logger.info(`Admin replied to session ${sessionId}`);

    res.json({
      success: true,
      data: { message },
    });
  }
);
