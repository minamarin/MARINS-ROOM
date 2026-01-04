/**
 * ============================================================================
 * TYPES INDEX - Shared TypeScript Type Definitions
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file defines all the "shapes" of data that flow through our application.
 * Think of types as contracts - they describe what properties an object must have.
 *
 * WHY WE NEED THIS:
 * -----------------
 * When the frontend (web app) talks to the backend (API), both sides need to
 * agree on what the data looks like. Types prevent bugs like:
 *   - "I expected 'amount' to be a number, but you sent a string!"
 *   - "Where is the 'email' field? I can't find it!"
 *
 * HOW TO READ THIS FILE:
 * ----------------------
 * 1. Each "interface" defines an object shape with required/optional properties
 * 2. Each "type" defines a set of allowed values (like an enum)
 * 3. Properties with "| null" can be empty/missing
 * 4. Properties with "?" are optional (don't have to be provided)
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - schemas/index.ts uses these types for runtime validation
 * - api-client/index.ts uses these types for type-safe API calls
 * - Both apps/api and apps/web import these types
 */

// ============================================
// Donation Types
// ============================================
// These types handle the donation/payment flow with Stripe

/**
 * DonationStatus - The lifecycle states of a donation
 *
 * PSEUDOCODE:
 * -----------
 * A donation can only be in ONE of these three states:
 *
 *   PENDING    → User started checkout but hasn't paid yet
 *                (Stripe session created, waiting for payment)
 *
 *   CONFIRMED  → Payment successful! Money received.
 *                (Stripe webhook confirmed the payment)
 *
 *   FAILED     → Payment failed (card declined, expired, etc.)
 *                (Stripe webhook reported a failure)
 *
 * State transitions:
 *   [New Donation] → PENDING → CONFIRMED (success)
 *                            → FAILED (error)
 */
export type DonationStatus = "PENDING" | "CONFIRMED" | "FAILED";

/**
 * Donation - A single donation record stored in the database
 *
 * PSEUDOCODE:
 * -----------
 * This represents one row in the "donations" database table.
 *
 * Required fields (always present):
 *   - id: Unique identifier (UUID format like "a1b2c3d4-...")
 *   - amount: How much in cents (e.g., 1000 = $10.00)
 *   - currency: Three-letter code like "usd", "eur", "gbp"
 *   - status: Current state (see DonationStatus above)
 *   - createdAt: When the donation was initiated
 *   - updatedAt: When the record was last modified
 *
 * Optional fields (may be null):
 *   - email: Donor's email (if they provided it)
 *   - name: Donor's name (if they provided it)
 *   - stripeSessionId: Reference to Stripe Checkout session
 *   - stripePaymentIntentId: Reference to actual payment
 *   - message: Personal message from donor (like "Keep up the great work!")
 */
export interface Donation {
  id: string;
  email: string | null;
  name: string | null;
  amount: number;
  currency: string;
  status: DonationStatus;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PaymentEvent - Audit log of all Stripe webhook events
 *
 * PSEUDOCODE:
 * -----------
 * Every time Stripe sends us a webhook (notification), we save it here.
 * This is important for:
 *   1. Debugging payment issues
 *   2. Preventing duplicate processing
 *   3. Audit trail for accounting
 *
 * Fields:
 *   - id: Our unique ID for this event record
 *   - donationId: Links to the related Donation
 *   - stripeEventId: Stripe's unique ID (used to prevent duplicates)
 *   - eventType: What happened (e.g., "checkout.session.completed")
 *   - payload: The full raw data Stripe sent us
 *   - createdAt: When we received this event
 */
export interface PaymentEvent {
  id: string;
  donationId: string;
  stripeEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

/**
 * CreateCheckoutSessionRequest - Data sent TO the API to start a donation
 *
 * PSEUDOCODE:
 * -----------
 * When a user clicks "Donate", the frontend sends this data:
 *
 *   REQUIRED:
 *   - amount: How much to charge in cents (100 = $1.00)
 *
 *   OPTIONAL (user can skip these):
 *   - currency: Defaults to "usd" if not provided
 *   - name: Donor's name for the receipt
 *   - email: Donor's email for the receipt
 *   - message: Personal message to include
 *
 * Example:
 *   { amount: 1000, name: "John", email: "john@email.com" }
 *   → Creates a $10.00 USD donation from John
 */
export interface CreateCheckoutSessionRequest {
  amount: number;
  currency?: string;
  name?: string;
  email?: string;
  message?: string;
}

/**
 * CreateCheckoutSessionResponse - Data returned FROM the API
 *
 * PSEUDOCODE:
 * -----------
 * After creating a Stripe checkout session, we return:
 *
 *   - sessionId: Stripe's ID for the checkout session
 *   - url: The Stripe checkout page URL
 *
 * The frontend then redirects the user to this URL to pay.
 *
 * Flow:
 *   1. Frontend sends CreateCheckoutSessionRequest
 *   2. API creates Stripe session, saves donation as PENDING
 *   3. API returns this response
 *   4. Frontend redirects user to the URL
 *   5. User pays on Stripe's secure page
 *   6. Stripe sends webhook to confirm payment
 */
export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

// ============================================
// Video Types
// ============================================
// These types handle video upload and management

/**
 * VideoStatus - The lifecycle states of an uploaded video
 *
 * PSEUDOCODE:
 * -----------
 * Videos go through these states during upload:
 *
 *   UPLOADING   → File is being uploaded to S3 storage
 *                 (User is actively uploading)
 *
 *   PROCESSING  → File uploaded, being processed
 *                 (Worker is generating thumbnails, etc.)
 *
 *   READY       → Video is fully processed and watchable
 *                 (All done! Viewers can watch it)
 *
 *   ERROR       → Something went wrong
 *                 (Upload failed, processing error, etc.)
 *
 * State transitions:
 *   [New Video] → UPLOADING → PROCESSING → READY (success)
 *                                        → ERROR (problem)
 */
export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "ERROR";

/**
 * Video - A video record stored in the database
 *
 * PSEUDOCODE:
 * -----------
 * This represents one row in the "videos" database table.
 *
 * Required fields:
 *   - id: Unique identifier (UUID)
 *   - title: Human-readable name
 *   - storageKey: Path in S3 (e.g., "videos/abc123/video.mp4")
 *   - status: Current state (see VideoStatus above)
 *   - createdAt/updatedAt: Timestamps
 *
 * Optional fields (filled in during processing):
 *   - description: Longer explanation of the video
 *   - playbackUrl: Where to stream from (null until READY)
 *   - thumbnailUrl: Preview image (generated by worker)
 *   - durationSeconds: Video length (detected during processing)
 *   - fileSizeBytes: File size in bytes
 *   - mimeType: File type (e.g., "video/mp4")
 */
export interface Video {
  id: string;
  title: string;
  description: string | null;
  storageKey: string;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  status: VideoStatus;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GetSignedUploadUrlRequest - Data sent TO the API to request upload permission
 *
 * PSEUDOCODE:
 * -----------
 * Before uploading, the frontend asks for a "signed URL" - a special
 * URL that allows uploading directly to S3 storage.
 *
 * This is called "pre-signed URL" pattern because:
 *   1. User's browser uploads directly to S3 (not through our API)
 *   2. This saves our server bandwidth
 *   3. The URL is only valid for a short time (security)
 *
 * Required data:
 *   - title: What to name this video
 *   - mimeType: The file type (e.g., "video/mp4")
 *   - fileSizeBytes: File size (to check it's not too big)
 *
 * Optional:
 *   - description: More details about the video
 */
export interface GetSignedUploadUrlRequest {
  title: string;
  description?: string;
  mimeType: string;
  fileSizeBytes: number;
}

/**
 * GetSignedUploadUrlResponse - Data returned FROM the API
 *
 * PSEUDOCODE:
 * -----------
 * The API returns everything needed to upload:
 *
 *   - uploadUrl: The signed URL for S3 (PUT request goes here)
 *   - storageKey: Where the file will be stored in S3
 *   - videoId: The database ID for this video record
 *
 * Upload flow:
 *   1. Frontend sends GetSignedUploadUrlRequest
 *   2. API creates video record (status: UPLOADING)
 *   3. API generates signed URL from S3
 *   4. API returns this response
 *   5. Frontend uploads file directly to uploadUrl
 *   6. Frontend tells API upload is complete
 *   7. Worker processes the video
 */
export interface GetSignedUploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
  videoId: string;
}

/**
 * UpdateVideoStatusRequest - Data sent TO update a video's status
 *
 * PSEUDOCODE:
 * -----------
 * Used by the worker or admin to update video status:
 *
 *   - status: New status to set
 *   - playbackUrl: Set when video is READY (where to stream from)
 *   - error: Set when status is ERROR (what went wrong)
 *
 * Example updates:
 *   { status: "PROCESSING" } → Started processing
 *   { status: "READY", playbackUrl: "https://..." } → Done!
 *   { status: "ERROR", error: "Invalid video format" } → Failed
 */
export interface UpdateVideoStatusRequest {
  status: VideoStatus;
  playbackUrl?: string;
  error?: string;
}

// ============================================
// Chat Types
// ============================================
// These types handle the real-time AI chat feature

/**
 * ChatSessionStatus - Whether a chat is still active
 *
 * PSEUDOCODE:
 * -----------
 *   ACTIVE  → Chat is ongoing, user can send messages
 *   CLOSED  → Chat ended, no more messages allowed
 */
export type ChatSessionStatus = "ACTIVE" | "CLOSED";

/**
 * MessageRole - Who sent a chat message
 *
 * PSEUDOCODE:
 * -----------
 *   USER      → Message from the website visitor
 *   ASSISTANT → Response from the AI
 *   SYSTEM    → System notifications (e.g., "Admin joined the chat")
 */
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

/**
 * ChatSession - A conversation thread in the database
 *
 * PSEUDOCODE:
 * -----------
 * Each chat session represents one conversation:
 *
 *   - id: Unique identifier (UUID)
 *   - visitorId: Anonymous ID for the visitor (stored in their browser)
 *   - visitorName: Display name (if they provided one)
 *   - status: ACTIVE or CLOSED
 *   - metadata: Extra data (like browser info, location, etc.)
 *   - createdAt/updatedAt: Timestamps
 *
 * One visitor can have multiple sessions (each page visit = new session)
 */
export interface ChatSession {
  id: string;
  visitorId: string;
  visitorName: string | null;
  status: ChatSessionStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ChatMessage - A single message in a chat
 *
 * PSEUDOCODE:
 * -----------
 *   - id: Unique identifier
 *   - sessionId: Which chat session this belongs to
 *   - role: Who sent it (USER, ASSISTANT, or SYSTEM)
 *   - content: The actual message text
 *   - createdAt: When it was sent
 */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

/**
 * StartChatSessionRequest - Data to start a new chat
 *
 * PSEUDOCODE:
 * -----------
 * Optional - visitor can remain anonymous or provide a name.
 */
export interface StartChatSessionRequest {
  visitorName?: string;
}

/**
 * StartChatSessionResponse - Data returned when chat starts
 *
 * PSEUDOCODE:
 * -----------
 * Returns the session ID and full session object so the
 * frontend can start sending messages.
 */
export interface StartChatSessionResponse {
  sessionId: string;
  session: ChatSession;
}

/**
 * SendMessageRequest - Data to send a chat message
 *
 * PSEUDOCODE:
 * -----------
 *   - sessionId: Which chat to send to
 *   - content: The message text
 */
export interface SendMessageRequest {
  sessionId: string;
  content: string;
}

/**
 * SendMessageResponse - Data returned after sending a message
 *
 * PSEUDOCODE:
 * -----------
 * Returns:
 *   - message: The saved user message
 *   - aiResponse: The AI's reply (optional - may be async via WebSocket)
 */
export interface SendMessageResponse {
  message: ChatMessage;
  aiResponse?: ChatMessage;
}

/**
 * ListSessionsResponse - Paginated list of chat sessions (admin)
 *
 * PSEUDOCODE:
 * -----------
 * For the admin dashboard to view all chats:
 *   - sessions: Array of sessions with message count
 *   - total: Total number of sessions (for pagination)
 */
export interface ListSessionsResponse {
  sessions: (ChatSession & { messageCount: number })[];
  total: number;
}

/**
 * GetSessionMessagesResponse - Full chat history
 *
 * PSEUDOCODE:
 * -----------
 * Returns a session and all its messages for display.
 */
export interface GetSessionMessagesResponse {
  session: ChatSession;
  messages: ChatMessage[];
}

// ============================================
// WebSocket Types
// ============================================
// These types define real-time communication messages

/**
 * WsMessageType - All possible WebSocket message types
 *
 * PSEUDOCODE:
 * -----------
 * WebSocket messages use a "type" field to identify what they are:
 *
 * CLIENT → SERVER:
 *   JOIN_SESSION   → Client wants to join a chat session
 *   LEAVE_SESSION  → Client is leaving the session
 *   SEND_MESSAGE   → Client is sending a chat message
 *   TYPING_START   → Client started typing
 *   TYPING_STOP    → Client stopped typing
 *
 * SERVER → CLIENT:
 *   MESSAGE_RECEIVED → A new message was received
 *   AI_RESPONSE      → AI generated a response
 *   ERROR            → Something went wrong
 *   SESSION_CLOSED   → The session was closed
 *   TYPING_START     → Someone else is typing
 *   TYPING_STOP      → Someone stopped typing
 */
export type WsMessageType =
  | "JOIN_SESSION"
  | "SESSION_JOINED"
  | "LEAVE_SESSION"
  | "SEND_MESSAGE"
  | "MESSAGE_RECEIVED"
  | "AI_RESPONSE"
  | "ERROR"
  | "SESSION_CLOSED"
  | "TYPING_START"
  | "TYPING_STOP";

/**
 * WsMessage - The base structure for all WebSocket messages
 *
 * PSEUDOCODE:
 * -----------
 * Every WebSocket message has:
 *   - type: What kind of message (see WsMessageType)
 *   - payload: The actual data (varies by type)
 *
 * Example:
 *   { type: "SEND_MESSAGE", payload: { content: "Hello!" } }
 */
export interface WsMessage {
  type: WsMessageType;
  payload: unknown;
}

/**
 * WsJoinSessionPayload - Data for joining a chat via WebSocket
 *
 * PSEUDOCODE:
 * -----------
 *   - sessionId: Which chat to join
 *   - isAdmin: Is this an admin joining? (optional)
 *   - adminKey: Admin API key for verification (optional)
 *
 * Admins can see all chats; regular users only see their own.
 */
export interface WsJoinSessionPayload {
  sessionId: string;
  isAdmin?: boolean;
  adminKey?: string;
}

/**
 * WsSendMessagePayload - Data for sending a message via WebSocket
 */
export interface WsSendMessagePayload {
  content: string;
}

/**
 * WsMessageReceivedPayload - Data when a new message is received
 */
export interface WsMessageReceivedPayload {
  message: ChatMessage;
}

/**
 * WsErrorPayload - Data when an error occurs
 *
 * PSEUDOCODE:
 * -----------
 *   - code: Machine-readable error code (e.g., "SESSION_NOT_FOUND")
 *   - message: Human-readable explanation
 */
export interface WsErrorPayload {
  code: string;
  message: string;
}

// ============================================
// API Response Types
// ============================================
// Standard wrapper types for all API responses

/**
 * ApiResponse<T> - Standard wrapper for all API responses
 *
 * PSEUDOCODE:
 * -----------
 * Every API endpoint returns data in this format:
 *
 * SUCCESS case:
 *   {
 *     success: true,
 *     data: { ... actual data ... }
 *   }
 *
 * ERROR case:
 *   {
 *     success: false,
 *     error: {
 *       code: "ERROR_CODE",
 *       message: "What went wrong",
 *       details: { ... extra info ... }
 *     }
 *   }
 *
 * The <T> is a "generic" - it means "whatever type of data you expect".
 * For example:
 *   ApiResponse<Donation> → Success contains a Donation
 *   ApiResponse<Video[]>  → Success contains an array of Videos
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * PaginatedResponse<T> - Standard wrapper for paginated lists
 *
 * PSEUDOCODE:
 * -----------
 * When fetching lists of items, we don't return everything at once
 * (that would be slow!). Instead, we return "pages" of data:
 *
 *   - items: The items for this page
 *   - total: Total number of items across all pages
 *   - page: Current page number (starting from 1)
 *   - pageSize: How many items per page
 *   - hasMore: Are there more pages after this one?
 *
 * Example for 100 items with pageSize 20:
 *   Page 1: items[0-19], total=100, page=1, hasMore=true
 *   Page 2: items[20-39], total=100, page=2, hasMore=true
 *   ...
 *   Page 5: items[80-99], total=100, page=5, hasMore=false
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// Blog Types (for type safety in web app)
// ============================================
// These types define the structure of MDX blog posts

/**
 * BlogPost - Full blog post with content
 *
 * PSEUDOCODE:
 * -----------
 * Represents a complete blog post including the MDX content:
 *
 *   - slug: URL-friendly identifier (e.g., "my-first-post")
 *   - title: Display title
 *   - description: Short summary for previews
 *   - date: Publication date (ISO format: "2024-01-15")
 *   - author: Who wrote it
 *   - tags: Categories (e.g., ["coding", "tutorial"])
 *   - published: Is it visible on the site?
 *   - content: The full MDX content (markdown + JSX)
 */
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  published: boolean;
  content: string;
}

/**
 * BlogPostMeta - Blog post metadata without content
 *
 * PSEUDOCODE:
 * -----------
 * Same as BlogPost but without the content field.
 * Used for listing posts (we don't need full content in the list).
 *
 * This is a common pattern:
 *   - List view: Show BlogPostMeta for each post (faster)
 *   - Detail view: Load full BlogPost when user clicks
 */
export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  published: boolean;
}
