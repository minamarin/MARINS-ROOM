import type { Server as HttpServer } from "http";

import type { WsMessage, WsJoinSessionPayload, WsSendMessagePayload } from "@marins-room/shared";
import { WsJoinSessionSchema, WsSendMessageSchema } from "@marins-room/shared";
import { WebSocketServer, WebSocket } from "ws";

import { env } from "../config/env.js";
import { getAIResponse } from "../lib/ai.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { checkRateLimit } from "../lib/redis.js";

interface ClientState {
  ws: WebSocket;
  sessionId: string | null;
  isAdmin: boolean;
  ip: string;
}

const clients = new Map<WebSocket, ClientState>();
const sessionClients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/chat",
  });

  wss.on("connection", (ws, req) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket.remoteAddress || "unknown";

    logger.info(`WebSocket client connected from ${ip}`);

    // Initialize client state
    clients.set(ws, {
      ws,
      sessionId: null,
      isAdmin: false,
      ip,
    });

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WsMessage;
        await handleMessage(ws, message);
      } catch (error) {
        logger.error("WebSocket message error:", error);
        sendError(ws, "INVALID_MESSAGE", "Failed to process message");
      }
    });

    ws.on("close", () => {
      const state = clients.get(ws);
      if (state?.sessionId) {
        leaveSession(ws, state.sessionId);
      }
      clients.delete(ws);
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error:", error);
    });
  });

  logger.info("WebSocket server initialized");
}

async function handleMessage(ws: WebSocket, message: WsMessage) {
  const state = clients.get(ws);
  if (!state) return;

  switch (message.type) {
    case "JOIN_SESSION":
      await handleJoinSession(ws, state, message.payload as WsJoinSessionPayload);
      break;
    case "LEAVE_SESSION":
      if (state.sessionId) {
        leaveSession(ws, state.sessionId);
        state.sessionId = null;
      }
      break;
    case "SEND_MESSAGE":
      await handleSendMessage(ws, state, message.payload as WsSendMessagePayload);
      break;
    case "TYPING_START":
    case "TYPING_STOP":
      // Broadcast typing indicators to session
      if (state.sessionId) {
        broadcastToSession(state.sessionId, {
          type: message.type,
          payload: { isAdmin: state.isAdmin },
        }, ws);
      }
      break;
    default:
      sendError(ws, "UNKNOWN_MESSAGE_TYPE", `Unknown message type: ${message.type}`);
  }
}

async function handleJoinSession(
  ws: WebSocket,
  state: ClientState,
  payload: WsJoinSessionPayload
) {
  const parsed = WsJoinSessionSchema.safeParse(payload);
  if (!parsed.success) {
    sendError(ws, "VALIDATION_ERROR", "Invalid join session payload");
    return;
  }

  const { sessionId, isAdmin, adminKey } = parsed.data;

  // Verify admin key if claiming admin
  if (isAdmin) {
    if (!adminKey || adminKey !== env.ADMIN_API_KEY) {
      sendError(ws, "UNAUTHORIZED", "Invalid admin key");
      return;
    }
    state.isAdmin = true;
  }

  // Verify session exists
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    sendError(ws, "SESSION_NOT_FOUND", "Chat session not found");
    return;
  }

  // Leave previous session if any
  if (state.sessionId) {
    leaveSession(ws, state.sessionId);
  }

  // Join new session
  state.sessionId = sessionId;
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(ws);

  // Send session history
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  ws.send(
    JSON.stringify({
      type: "SESSION_JOINED",
      payload: { session, messages },
    })
  );

  logger.info(`Client joined session ${sessionId} (admin: ${state.isAdmin})`);
}

async function handleSendMessage(
  ws: WebSocket,
  state: ClientState,
  payload: WsSendMessagePayload
) {
  if (!state.sessionId) {
    sendError(ws, "NOT_IN_SESSION", "You must join a session first");
    return;
  }

  const parsed = WsSendMessageSchema.safeParse(payload);
  if (!parsed.success) {
    sendError(ws, "VALIDATION_ERROR", "Invalid message payload");
    return;
  }

  // Rate limit
  const rateKey = `ws-message:${state.ip}`;
  const rateResult = await checkRateLimit(rateKey, 30, 60);
  if (!rateResult.allowed) {
    sendError(ws, "RATE_LIMITED", "Too many messages. Please slow down.");
    return;
  }

  const { content } = parsed.data;

  // Verify session is still active
  const session = await prisma.chatSession.findUnique({
    where: { id: state.sessionId },
  });

  if (!session || session.status !== "ACTIVE") {
    sendError(ws, "SESSION_CLOSED", "This session has been closed");
    return;
  }

  // Save message
  const role = state.isAdmin ? "ASSISTANT" : "USER";
  const messageContent = state.isAdmin ? `[Marin]: ${content}` : content;

  const message = await prisma.chatMessage.create({
    data: {
      sessionId: state.sessionId,
      role,
      content: messageContent,
    },
  });

  // Broadcast to all clients in session
  broadcastToSession(state.sessionId, {
    type: "MESSAGE_RECEIVED",
    payload: { message },
  });

  // If user message, get AI response
  if (!state.isAdmin) {
    // Get conversation history
    const history = await prisma.chatMessage.findMany({
      where: { sessionId: state.sessionId },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    // Broadcast typing indicator
    broadcastToSession(state.sessionId, {
      type: "TYPING_START",
      payload: { isAdmin: false },
    });

    const aiResult = await getAIResponse(
      history.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant" | "system",
        content: m.content,
      }))
    );

    // Stop typing indicator
    broadcastToSession(state.sessionId, {
      type: "TYPING_STOP",
      payload: { isAdmin: false },
    });

    if (aiResult.content) {
      const aiMessage = await prisma.chatMessage.create({
        data: {
          sessionId: state.sessionId,
          role: "ASSISTANT",
          content: aiResult.content,
        },
      });

      broadcastToSession(state.sessionId, {
        type: "AI_RESPONSE",
        payload: { message: aiMessage },
      });
    }
  }

  // Update session timestamp
  await prisma.chatSession.update({
    where: { id: state.sessionId },
    data: { updatedAt: new Date() },
  });
}

function leaveSession(ws: WebSocket, sessionId: string) {
  const clients = sessionClients.get(sessionId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      sessionClients.delete(sessionId);
    }
  }
}

function broadcastToSession(sessionId: string, message: WsMessage, exclude?: WebSocket) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;

  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function sendError(ws: WebSocket, code: string, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "ERROR",
        payload: { code, message },
      })
    );
  }
}
