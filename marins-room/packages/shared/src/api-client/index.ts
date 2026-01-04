/**
 * ============================================================================
 * API CLIENT - Type-Safe HTTP Client for Backend Communication
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file provides a clean, type-safe way for the frontend (web app) to
 * communicate with the backend (API). Instead of writing fetch() calls
 * everywhere, you import this client and call methods like:
 *
 *   const client = createApiClient({ baseUrl: "http://localhost:4000" });
 *   const result = await client.createCheckoutSession({ amount: 1000 });
 *
 * WHY WE NEED THIS:
 * -----------------
 * 1. TYPE SAFETY: TypeScript knows exactly what data each method returns
 * 2. CONSISTENCY: All API calls use the same error handling pattern
 * 3. DRY CODE: Don't repeat fetch() boilerplate everywhere
 * 4. EASY TESTING: Can mock the client in tests
 *
 * HOW IT WORKS:
 * -------------
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                        YOUR FRONTEND CODE                       │
 *   │  const result = await apiClient.createCheckoutSession(data)    │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                         API CLIENT                              │
 *   │  1. Builds full URL: baseUrl + "/payments/checkout-session"    │
 *   │  2. Adds headers: Content-Type, x-admin-api-key (if admin)     │
 *   │  3. Makes fetch() request                                      │
 *   │  4. Parses JSON response                                       │
 *   │  5. Returns typed ApiResponse<T>                               │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                      BACKEND API SERVER                         │
 *   │  (apps/api running on localhost:4000)                          │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - Imports types from ../types/index.ts
 * - Used by apps/web components to make API calls
 * - Mirrors the routes defined in apps/api
 */

import type {
  ApiResponse,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  Donation,
  GetSessionMessagesResponse,
  GetSignedUploadUrlRequest,
  GetSignedUploadUrlResponse,
  ListSessionsResponse,
  PaginatedResponse,
  SendMessageRequest,
  SendMessageResponse,
  StartChatSessionRequest,
  StartChatSessionResponse,
  UpdateVideoStatusRequest,
  Video,
} from "../types/index.js";

/**
 * ApiClientConfig - Configuration for creating an API client
 *
 * PSEUDOCODE:
 * -----------
 * When creating a client, you must provide:
 *   - baseUrl: Where the API server is running
 *   - adminApiKey: (Optional) For admin-only endpoints
 *
 * Example:
 *   // Regular user client (no admin access)
 *   { baseUrl: "http://localhost:4000" }
 *
 *   // Admin client (can access all endpoints)
 *   { baseUrl: "http://localhost:4000", adminApiKey: "secret-key-here" }
 */
export interface ApiClientConfig {
  baseUrl: string;
  adminApiKey?: string;
}

/**
 * ApiClient - The main class for making API requests
 *
 * PSEUDOCODE:
 * -----------
 * This class:
 *   1. Stores the configuration (baseUrl, adminApiKey)
 *   2. Provides a private request() method for all HTTP calls
 *   3. Exposes public methods for each API endpoint
 *
 * Design pattern: This is a "Facade" pattern - it hides the complexity
 * of HTTP requests behind simple method calls.
 */
export class ApiClient {
  /**
   * Private properties - only accessible inside this class
   *
   * PSEUDOCODE:
   * -----------
   * - baseUrl: Stored without trailing slash for clean URL building
   * - adminApiKey: Stored for adding to headers (if provided)
   */
  private baseUrl: string;
  private adminApiKey?: string;

  /**
   * Constructor - Called when you do `new ApiClient(config)`
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take the config object
   * 2. Remove trailing slash from baseUrl (if any)
   *    - "http://localhost:4000/" becomes "http://localhost:4000"
   *    - This prevents double slashes like "http://localhost:4000//health"
   * 3. Store the adminApiKey for later use
   *
   * Example:
   *   const client = new ApiClient({
   *     baseUrl: "http://localhost:4000/",
   *     adminApiKey: "my-secret-key"
   *   });
   *   // client.baseUrl is now "http://localhost:4000" (no trailing slash)
   */
  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.adminApiKey = config.adminApiKey;
  }

  /**
   * request() - The core method that all other methods use
   *
   * PSEUDOCODE:
   * -----------
   * This is a GENERIC method - <T> means "whatever type you expect back"
   *
   * INPUT:
   *   - endpoint: The API path (e.g., "/health", "/donations")
   *   - options: Standard fetch options (method, body, headers)
   *
   * OUTPUT:
   *   - ApiResponse<T>: Either { success: true, data: T }
   *                     or { success: false, error: {...} }
   *
   * STEPS:
   *   1. BUILD URL
   *      - Combine baseUrl + endpoint
   *      - Example: "http://localhost:4000" + "/health" = full URL
   *
   *   2. BUILD HEADERS
   *      - Always add "Content-Type: application/json"
   *      - Merge any extra headers from options
   *      - If adminApiKey exists, add "x-admin-api-key" header
   *
   *   3. MAKE REQUEST
   *      - Use fetch() with the URL and options
   *      - Wrap in try/catch for network errors
   *
   *   4. PARSE RESPONSE
   *      - Parse JSON from response body
   *      - Check if response.ok (status 200-299)
   *
   *   5. RETURN RESULT
   *      - If ok: { success: true, data: parsedData.data }
   *      - If not ok: { success: false, error: parsedData.error }
   *      - If network error: { success: false, error: { code: "NETWORK_ERROR" } }
   *
   * WHY PRIVATE?
   *   - External code shouldn't call this directly
   *   - Use the specific methods like createCheckoutSession() instead
   *   - Those methods have proper types for their specific endpoints
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // STEP 1: Build the full URL
    const url = `${this.baseUrl}${endpoint}`;

    // STEP 2: Build headers object
    // Start with Content-Type and merge any provided headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Add admin API key header if configured
    // This is how the API knows we're an admin
    if (this.adminApiKey) {
      (headers as Record<string, string>)["x-admin-api-key"] = this.adminApiKey;
    }

    // STEPS 3-5: Make request and handle response
    try {
      // Make the actual HTTP request
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Parse the JSON response body
      const data = await response.json();

      // Check if the response status indicates success (200-299)
      if (!response.ok) {
        // Server returned an error (4xx or 5xx status)
        return {
          success: false,
          error: {
            code: data.error?.code || "UNKNOWN_ERROR",
            message: data.error?.message || "An unknown error occurred",
            details: data.error?.details,
          },
        };
      }

      // Success! Return the data
      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      // Network error (server down, no internet, etc.)
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error occurred",
        },
      };
    }
  }

  // ============================================
  // Donation Endpoints
  // ============================================

  /**
   * createCheckoutSession() - Start a new donation/payment
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take donation info (amount, optional name/email/message)
   * 2. POST to /payments/checkout-session
   * 3. Return the Stripe checkout URL
   *
   * Frontend usage:
   *   const result = await client.createCheckoutSession({ amount: 1000 });
   *   if (result.success) {
   *     // Redirect user to result.data.url (Stripe checkout page)
   *     window.location.href = result.data.url;
   *   }
   */
  async createCheckoutSession(
    payload: CreateCheckoutSessionRequest
  ): Promise<ApiResponse<CreateCheckoutSessionResponse>> {
    return this.request<CreateCheckoutSessionResponse>("/payments/checkout-session", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * getDonation() - Get a single donation by ID
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take donation ID (UUID string)
   * 2. GET from /donations/{id}
   * 3. Return the donation record
   *
   * Note: This is admin-only. Requires adminApiKey in config.
   */
  async getDonation(id: string): Promise<ApiResponse<Donation>> {
    return this.request<Donation>(`/donations/${id}`);
  }

  /**
   * listDonations() - Get paginated list of all donations
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take optional page number and page size
   * 2. GET from /donations?page=X&pageSize=Y
   * 3. Return paginated list
   *
   * Note: This is admin-only. Requires adminApiKey in config.
   */
  async listDonations(
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<PaginatedResponse<Donation>>> {
    return this.request<PaginatedResponse<Donation>>(
      `/donations?page=${page}&pageSize=${pageSize}`
    );
  }

  // ============================================
  // Video Endpoints
  // ============================================

  /**
   * getSignedUploadUrl() - Request permission to upload a video
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take video metadata (title, mimeType, size)
   * 2. POST to /uploads/video/signed-url
   * 3. API creates database record + generates S3 signed URL
   * 4. Return the signed URL for direct upload to S3
   *
   * Frontend usage:
   *   const result = await client.getSignedUploadUrl({
   *     title: "My Video",
   *     mimeType: "video/mp4",
   *     fileSizeBytes: 52428800
   *   });
   *   if (result.success) {
   *     // Now upload directly to S3 using result.data.uploadUrl
   *     await fetch(result.data.uploadUrl, {
   *       method: "PUT",
   *       body: videoFile
   *     });
   *   }
   */
  async getSignedUploadUrl(
    payload: GetSignedUploadUrlRequest
  ): Promise<ApiResponse<GetSignedUploadUrlResponse>> {
    return this.request<GetSignedUploadUrlResponse>("/uploads/video/signed-url", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * getVideo() - Get a single video by ID
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take video ID (UUID string)
   * 2. GET from /videos/{id}
   * 3. Return the video record (includes playbackUrl when READY)
   */
  async getVideo(id: string): Promise<ApiResponse<Video>> {
    return this.request<Video>(`/videos/${id}`);
  }

  /**
   * listVideos() - Get paginated list of all videos
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take optional page number and page size
   * 2. GET from /videos?page=X&pageSize=Y
   * 3. Return paginated list
   */
  async listVideos(
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<PaginatedResponse<Video>>> {
    return this.request<PaginatedResponse<Video>>(`/videos?page=${page}&pageSize=${pageSize}`);
  }

  /**
   * updateVideoStatus() - Update a video's processing status
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take video ID and new status info
   * 2. PATCH to /videos/{id}/status
   * 3. Return updated video record
   *
   * Note: Typically called by the worker after processing.
   */
  async updateVideoStatus(
    id: string,
    payload: UpdateVideoStatusRequest
  ): Promise<ApiResponse<Video>> {
    return this.request<Video>(`/videos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  /**
   * confirmVideoUpload() - Tell the API that upload is complete
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take video ID
   * 2. POST to /videos/{id}/confirm-upload
   * 3. This triggers the worker to start processing
   * 4. Return updated video record
   *
   * Called by frontend AFTER the S3 upload finishes:
   *   // 1. Get signed URL
   *   const urlResult = await client.getSignedUploadUrl(metadata);
   *   // 2. Upload to S3
   *   await uploadToS3(urlResult.data.uploadUrl, file);
   *   // 3. Confirm upload
   *   await client.confirmVideoUpload(urlResult.data.videoId);
   */
  async confirmVideoUpload(id: string): Promise<ApiResponse<Video>> {
    return this.request<Video>(`/videos/${id}/confirm-upload`, {
      method: "POST",
    });
  }

  // ============================================
  // Chat Endpoints
  // ============================================

  /**
   * startChatSession() - Begin a new chat conversation
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take optional visitor name
   * 2. POST to /chat/sessions
   * 3. Return new session ID and details
   *
   * After getting a session, connect via WebSocket for real-time chat.
   */
  async startChatSession(
    payload: StartChatSessionRequest
  ): Promise<ApiResponse<StartChatSessionResponse>> {
    return this.request<StartChatSessionResponse>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * sendMessage() - Send a chat message (REST endpoint)
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take session ID and message content
   * 2. POST to /chat/messages
   * 3. Return saved message and AI response
   *
   * Note: For real-time chat, use WebSocket instead. This REST
   * endpoint is for simple request-response chat or fallback.
   */
  async sendMessage(payload: SendMessageRequest): Promise<ApiResponse<SendMessageResponse>> {
    return this.request<SendMessageResponse>("/chat/messages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * listChatSessions() - Get all chat sessions (admin)
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take optional page number and page size
   * 2. GET from /chat/sessions?page=X&pageSize=Y
   * 3. Return paginated list with message counts
   *
   * Note: Admin-only endpoint for viewing all conversations.
   */
  async listChatSessions(
    page = 1,
    pageSize = 20
  ): Promise<ApiResponse<ListSessionsResponse>> {
    return this.request<ListSessionsResponse>(
      `/chat/sessions?page=${page}&pageSize=${pageSize}`
    );
  }

  /**
   * getSessionMessages() - Get all messages in a chat session
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take session ID
   * 2. GET from /chat/sessions/{sessionId}/messages
   * 3. Return session details and all messages
   */
  async getSessionMessages(sessionId: string): Promise<ApiResponse<GetSessionMessagesResponse>> {
    return this.request<GetSessionMessagesResponse>(`/chat/sessions/${sessionId}/messages`);
  }

  /**
   * closeSession() - End a chat session
   *
   * PSEUDOCODE:
   * -----------
   * 1. Take session ID
   * 2. POST to /chat/sessions/{sessionId}/close
   * 3. Session status changes to CLOSED
   * 4. No more messages can be sent to this session
   */
  async closeSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/chat/sessions/${sessionId}/close`, {
      method: "POST",
    });
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * healthCheck() - Check if the API server is running
   *
   * PSEUDOCODE:
   * -----------
   * 1. GET from /health
   * 2. Return status and timestamp
   *
   * Useful for:
   *   - Monitoring (is the server up?)
   *   - Startup checks (wait for API before showing UI)
   *   - Debugging connectivity issues
   *
   * Example response when healthy:
   *   { success: true, data: { status: "healthy", timestamp: "2024-..." } }
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>("/health");
  }
}

/**
 * createApiClient() - Factory function to create an API client
 *
 * PSEUDOCODE:
 * -----------
 * This is a convenience function. Instead of:
 *   const client = new ApiClient(config);
 *
 * You can write:
 *   const client = createApiClient(config);
 *
 * Both do the same thing. The function style is often preferred
 * because it's slightly shorter and reads more naturally.
 *
 * Example:
 *   // In your app
 *   const api = createApiClient({
 *     baseUrl: process.env.API_URL || "http://localhost:4000"
 *   });
 *
 *   // Now use it
 *   const health = await api.healthCheck();
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
