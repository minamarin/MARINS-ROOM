/**
 * ============================================================================
 * SCHEMAS INDEX - Runtime Validation with Zod
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file defines validation schemas using the Zod library. While TypeScript
 * types only exist at compile time (they disappear when code runs), Zod schemas
 * validate data at RUNTIME - when your app is actually running.
 *
 * WHY WE NEED THIS:
 * -----------------
 * TypeScript types can't protect you from bad data coming from:
 *   - User input (forms, query params)
 *   - API requests from external sources
 *   - Webhook payloads
 *   - Database queries
 *
 * Zod catches these issues BEFORE they cause crashes:
 *   - "amount must be a number" (user typed "abc")
 *   - "email format is invalid" (user typed "not-an-email")
 *   - "file size exceeds maximum" (user uploaded 10GB file)
 *
 * HOW TO READ THIS FILE:
 * ----------------------
 * 1. z.object({...}) - Defines an object with specific fields
 * 2. z.string() - Must be a string
 * 3. z.number() - Must be a number
 * 4. .min(), .max() - Value must be within range
 * 5. .optional() - Field doesn't have to be present
 * 6. .default(value) - Use this value if not provided
 * 7. z.enum([...]) - Must be one of these exact values
 * 8. .regex() - Must match this pattern
 * 9. .refine() - Custom validation function
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - Uses Zod library (imported at top)
 * - types/index.ts has corresponding TypeScript types
 * - apps/api uses these to validate incoming requests
 * - z.infer<typeof Schema> generates TypeScript types automatically
 */

import { z } from "zod";

// ============================================
// Donation Schemas
// ============================================

/**
 * DonationStatusSchema - Validates donation status values
 *
 * PSEUDOCODE:
 * -----------
 * Input: any value
 * Output: "PENDING" | "CONFIRMED" | "FAILED"
 * Error: If input is not one of these exact strings
 *
 * Example:
 *   DonationStatusSchema.parse("PENDING")  → "PENDING" (success)
 *   DonationStatusSchema.parse("pending")  → ERROR (case sensitive!)
 *   DonationStatusSchema.parse("UNKNOWN")  → ERROR (not in list)
 */
export const DonationStatusSchema = z.enum(["PENDING", "CONFIRMED", "FAILED"]);

/**
 * CreateCheckoutSessionSchema - Validates data for creating a checkout
 *
 * PSEUDOCODE:
 * -----------
 * Validates the request body when someone starts a donation:
 *
 * amount:
 *   - Required, must be an integer (whole number)
 *   - Minimum: 100 cents ($1.00) - Stripe minimum
 *   - Maximum: 100,000,000 cents ($1,000,000.00) - reasonable limit
 *
 * currency:
 *   - Optional, defaults to "usd"
 *   - Must be exactly 3 characters (ISO currency codes)
 *
 * name:
 *   - Optional (donor can remain anonymous)
 *   - Maximum 100 characters
 *
 * email:
 *   - Optional
 *   - Must be valid email format if provided
 *
 * message:
 *   - Optional personal message
 *   - Maximum 500 characters
 *
 * Example valid input:
 *   {
 *     amount: 2500,        // $25.00
 *     currency: "usd",
 *     name: "Jane Doe",
 *     email: "jane@example.com",
 *     message: "Keep up the great work!"
 *   }
 *
 * Example invalid input:
 *   { amount: 50 }  // ERROR: minimum is 100 cents
 *   { amount: "25" } // ERROR: must be a number
 */
export const CreateCheckoutSessionSchema = z.object({
  amount: z.number().int().min(100).max(100000000), // Min $1, max $1M in cents
  currency: z.string().length(3).default("usd"),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  message: z.string().max(500).optional(),
});

/**
 * DonationIdSchema - Validates a donation ID
 *
 * PSEUDOCODE:
 * -----------
 * Donation IDs are UUIDs (Universally Unique Identifiers).
 * Format: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 *
 * Example:
 *   DonationIdSchema.parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890") → valid
 *   DonationIdSchema.parse("not-a-uuid") → ERROR
 *   DonationIdSchema.parse("12345") → ERROR
 */
export const DonationIdSchema = z.string().uuid();

// ============================================
// Video Schemas
// ============================================

/**
 * VideoStatusSchema - Validates video status values
 *
 * PSEUDOCODE:
 * -----------
 * Same pattern as DonationStatusSchema.
 * Must be exactly one of: "UPLOADING", "PROCESSING", "READY", "ERROR"
 */
export const VideoStatusSchema = z.enum(["UPLOADING", "PROCESSING", "READY", "ERROR"]);

/**
 * GetSignedUploadUrlSchema - Validates video upload request
 *
 * PSEUDOCODE:
 * -----------
 * When requesting permission to upload a video, validate:
 *
 * title:
 *   - Required
 *   - 1-200 characters
 *
 * description:
 *   - Optional
 *   - Maximum 2000 characters
 *
 * mimeType:
 *   - Required
 *   - Must start with "video/" (regex check)
 *   - Must be one of supported formats (refine check):
 *     - video/mp4 (most common)
 *     - video/webm (web-optimized)
 *     - video/quicktime (MOV files)
 *     - video/x-msvideo (AVI files)
 *
 * fileSizeBytes:
 *   - Required, must be positive integer
 *   - Maximum: 5GB (5 * 1024 * 1024 * 1024 bytes)
 *
 * Why two checks for mimeType?
 *   1. .regex(/^video\//) - Quick check: is it any video type?
 *   2. .refine(...) - Detailed check: is it a SUPPORTED video type?
 *
 * Example valid input:
 *   {
 *     title: "My Vacation Video",
 *     mimeType: "video/mp4",
 *     fileSizeBytes: 52428800  // 50MB
 *   }
 */
export const GetSignedUploadUrlSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  mimeType: z
    .string()
    .regex(/^video\//, "Must be a video MIME type")
    .refine(
      (mime) => ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"].includes(mime),
      "Unsupported video format"
    ),
  fileSizeBytes: z.number().int().min(1).max(5 * 1024 * 1024 * 1024), // Max 5GB
});

/**
 * UpdateVideoStatusSchema - Validates video status update
 *
 * PSEUDOCODE:
 * -----------
 * Used by workers/admins to update video processing status:
 *
 *   status: Required - new status
 *   playbackUrl: Optional - set when video is READY
 *   error: Optional - set when status is ERROR
 *
 * Example:
 *   { status: "READY", playbackUrl: "https://cdn.example.com/video.mp4" }
 *   { status: "ERROR", error: "Video codec not supported" }
 */
export const UpdateVideoStatusSchema = z.object({
  status: VideoStatusSchema,
  playbackUrl: z.string().url().optional(),
  error: z.string().max(500).optional(),
});

/**
 * VideoIdSchema - Validates a video ID (UUID format)
 */
export const VideoIdSchema = z.string().uuid();

// ============================================
// Chat Schemas
// ============================================

/**
 * ChatSessionStatusSchema - Validates chat session status
 *
 * PSEUDOCODE:
 * -----------
 * Must be either "ACTIVE" or "CLOSED"
 */
export const ChatSessionStatusSchema = z.enum(["ACTIVE", "CLOSED"]);

/**
 * MessageRoleSchema - Validates who sent a message
 *
 * PSEUDOCODE:
 * -----------
 * Must be one of: "USER", "ASSISTANT", "SYSTEM"
 */
export const MessageRoleSchema = z.enum(["USER", "ASSISTANT", "SYSTEM"]);

/**
 * StartChatSessionSchema - Validates new chat session request
 *
 * PSEUDOCODE:
 * -----------
 * visitorName: Optional display name, max 50 characters
 *
 * Visitors can start anonymous chats or provide a name.
 */
export const StartChatSessionSchema = z.object({
  visitorName: z.string().max(50).optional(),
});

/**
 * SendMessageSchema - Validates outgoing chat messages
 *
 * PSEUDOCODE:
 * -----------
 * sessionId:
 *   - Required UUID of the chat session
 *
 * content:
 *   - Required message text
 *   - 1-4000 characters (no empty messages, reasonable limit)
 *
 * Example:
 *   {
 *     sessionId: "a1b2c3d4-...",
 *     content: "Hello! Can you help me with something?"
 *   }
 */
export const SendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

/**
 * SessionIdSchema - Validates a session ID (UUID format)
 */
export const SessionIdSchema = z.string().uuid();

// ============================================
// WebSocket Schemas
// ============================================

/**
 * WsJoinSessionSchema - Validates WebSocket join request
 *
 * PSEUDOCODE:
 * -----------
 * When a client connects via WebSocket and wants to join a chat:
 *
 *   sessionId: Required - which chat to join
 *   isAdmin: Optional - are they joining as admin?
 *   adminKey: Optional - admin API key for verification
 *
 * Security note:
 *   If isAdmin is true, adminKey MUST be valid or request is rejected.
 *   This check happens in the WebSocket handler, not here.
 */
export const WsJoinSessionSchema = z.object({
  sessionId: z.string().uuid(),
  isAdmin: z.boolean().optional(),
  adminKey: z.string().optional(),
});

/**
 * WsSendMessageSchema - Validates WebSocket message
 *
 * PSEUDOCODE:
 * -----------
 * Same constraints as SendMessageSchema content:
 *   - 1-4000 characters
 *   - No empty messages
 */
export const WsSendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

// ============================================
// Pagination Schemas
// ============================================

/**
 * PaginationSchema - Validates pagination query parameters
 *
 * PSEUDOCODE:
 * -----------
 * Used for list endpoints that return paginated results:
 *
 *   page:
 *     - Which page to fetch (starting from 1, not 0)
 *     - Default: 1 (first page)
 *     - z.coerce.number() converts string "1" to number 1
 *       (query params come as strings from URLs)
 *
 *   pageSize:
 *     - How many items per page
 *     - Default: 20
 *     - Minimum: 1 (at least one item)
 *     - Maximum: 100 (prevent huge queries)
 *
 * Example URL: /donations?page=2&pageSize=50
 * Parsed: { page: 2, pageSize: 50 }
 *
 * Example URL: /donations
 * Parsed: { page: 1, pageSize: 20 } (defaults applied)
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Admin Auth Schema
// ============================================

/**
 * AdminApiKeySchema - Validates admin API key format
 *
 * PSEUDOCODE:
 * -----------
 * Admin API keys must be:
 *   - At least 32 characters (security minimum)
 *   - At most 128 characters (reasonable maximum)
 *
 * This only validates FORMAT, not whether the key is correct.
 * Actual key verification happens by comparing with ADMIN_API_KEY env var.
 *
 * Why 32 minimum?
 *   - Short keys are easily guessed
 *   - 32 chars gives ~192 bits of entropy with alphanumeric chars
 *   - Industry standard for API keys
 */
export const AdminApiKeySchema = z.string().min(32).max(128);

// ============================================
// Utility Types from Schemas
// ============================================

/**
 * z.infer<typeof Schema> - Magic that generates TypeScript types
 *
 * PSEUDOCODE:
 * -----------
 * Instead of writing types AND schemas separately (error-prone),
 * we write the schema once and DERIVE the type from it.
 *
 * Before (manual, might get out of sync):
 *   interface CreateCheckoutInput { amount: number; currency?: string; ... }
 *   const CreateCheckoutSchema = z.object({ amount: z.number(), ... })
 *
 * After (automatic, always in sync):
 *   const CreateCheckoutSchema = z.object({ amount: z.number(), ... })
 *   type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>
 *
 * The "infer" keyword reads the schema and generates matching types!
 */

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;
export type GetSignedUploadUrlInput = z.infer<typeof GetSignedUploadUrlSchema>;
export type UpdateVideoStatusInput = z.infer<typeof UpdateVideoStatusSchema>;
export type StartChatSessionInput = z.infer<typeof StartChatSessionSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
