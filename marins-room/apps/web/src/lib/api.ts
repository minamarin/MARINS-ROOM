import { createApiClient } from "@marins-room/shared";

const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const adminApiKey = process.env.ADMIN_API_KEY;

// Server-side client with admin key (if available)
export const serverApi = createApiClient({
  baseUrl: apiUrl,
  adminApiKey,
});

// Client-side client without admin key
export const clientApi = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
});

export const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/chat";
