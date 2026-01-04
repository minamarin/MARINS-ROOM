/**
 * ============================================================================
 * RATE LIMITING MIDDLEWARE - Protect Against Abuse
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This middleware limits how many requests a client can make in a time window.
 * It prevents abuse like:
 *   - API spam attacks (thousands of requests per second)
 *   - Brute force password guessing
 *   - Denial of service (overwhelming the server)
 *   - Scraping data too quickly
 *
 * HOW RATE LIMITING WORKS:
 * ------------------------
 *
 *   Client makes request
 *          │
 *          ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    RATE LIMIT CHECK                             │
 *   │                                                                 │
 *   │  1. Get client identifier (IP address)                         │
 *   │  2. Build key: "prefix:192.168.1.1"                            │
 *   │  3. Check Redis: how many requests in current window?          │
 *   │  4. If under limit → allow, increment counter                  │
 *   │     If over limit → reject with 429                            │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * SLIDING WINDOW ALGORITHM:
 * -------------------------
 * We use a "sliding window" approach stored in Redis:
 *
 *   Window: 60 seconds, Limit: 100 requests
 *
 *   Time 0:00 - Request 1   → ✅ Count: 1/100
 *   Time 0:10 - Request 50  → ✅ Count: 50/100
 *   Time 0:30 - Request 100 → ✅ Count: 100/100
 *   Time 0:31 - Request 101 → ❌ Rate limited!
 *   Time 1:00 - Window resets
 *   Time 1:01 - Request 1   → ✅ Count: 1/100
 *
 * WHY USE REDIS?
 * --------------
 * Redis is perfect for rate limiting because:
 *   - Super fast (in-memory)
 *   - Supports atomic operations (INCR)
 *   - Has built-in expiration (TTL)
 *   - Shared across multiple server instances
 *
 * If using in-memory storage:
 *   - Doesn't work with multiple servers
 *   - Lost on server restart
 *   - Uses server RAM
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - Uses checkRateLimit from lib/redis.ts
 * - Applied to routes via route definitions
 * - Different routes can have different limits
 */

import type { Request, Response, NextFunction } from "express";

import { checkRateLimit } from "../lib/redis.js";

/**
 * RateLimitOptions - Configuration for rate limiting
 *
 * PSEUDOCODE:
 * -----------
 * limit: Maximum number of requests allowed in the window
 *        Example: 100 requests
 *
 * windowSeconds: How long the time window lasts
 *                Example: 60 seconds
 *
 * keyPrefix: Unique prefix to separate different rate limits
 *            Example: "api:chat" vs "api:donations"
 *            This allows different limits for different endpoints
 */
interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix: string;
}

/**
 * rateLimit - Factory for rate limiting middleware
 *
 * PSEUDOCODE:
 * -----------
 * INPUT:
 *   - options: { limit, windowSeconds, keyPrefix }
 *
 * RETURNS:
 *   - Express middleware function
 *
 * THE RETURNED MIDDLEWARE:
 *
 * 1. IDENTIFY THE CLIENT
 *    - Get IP address from request
 *    - IP is the most common identifier for rate limiting
 *    - Fallback to socket address or "unknown"
 *
 * 2. BUILD REDIS KEY
 *    - Combine prefix and IP: "chat:192.168.1.1"
 *    - Different prefixes = different rate limits
 *
 * 3. CHECK RATE LIMIT
 *    - Call Redis to check/increment the counter
 *    - Returns: { allowed, remaining, resetIn }
 *
 * 4. SET RESPONSE HEADERS
 *    - X-RateLimit-Limit: Total allowed requests
 *    - X-RateLimit-Remaining: Requests left in window
 *    - X-RateLimit-Reset: Seconds until window resets
 *
 * 5. RESPOND
 *    - If allowed: call next() to continue
 *    - If not allowed: return 429 Too Many Requests
 *
 * USAGE EXAMPLE:
 * --------------
 * import { rateLimit } from "../middleware/rateLimit.js";
 *
 * // Allow 100 chat messages per minute
 * router.post(
 *   "/messages",
 *   rateLimit({ limit: 100, windowSeconds: 60, keyPrefix: "chat" }),
 *   sendMessage
 * );
 *
 * // Allow 10 checkout attempts per minute (stricter for payments)
 * router.post(
 *   "/checkout",
 *   rateLimit({ limit: 10, windowSeconds: 60, keyPrefix: "checkout" }),
 *   createCheckout
 * );
 *
 * FAIL-OPEN BEHAVIOR:
 * -------------------
 * If Redis is down, we ALLOW the request instead of blocking.
 * This is a deliberate choice:
 *   - Better to allow some abuse than block all legitimate users
 *   - The error is logged for monitoring
 *   - Production should have Redis monitoring/alerting
 */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // STEP 1: Identify the client by IP address
    // req.ip may be undefined (e.g., in some test environments)
    // Fallback to socket.remoteAddress, then "unknown"
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    // STEP 2: Build the Redis key
    // Format: "prefix:ip" e.g., "chat:192.168.1.1"
    const key = `${options.keyPrefix}:${ip}`;

    try {
      // STEP 3: Check rate limit in Redis
      // This increments the counter and returns current state
      const result = await checkRateLimit(key, options.limit, options.windowSeconds);

      // STEP 4: Set rate limit headers
      // These are standard headers that clients can use to:
      // - Display remaining requests in UI
      // - Implement client-side throttling
      // - Debug rate limit issues
      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", result.remaining);
      res.setHeader("X-RateLimit-Reset", result.resetIn);

      // STEP 5: Check if request is allowed
      if (!result.allowed) {
        // Over the limit - reject with 429 Too Many Requests
        return res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        });
      }

      // Under the limit - continue to the next middleware/route
      next();
    } catch (error) {
      // FAIL-OPEN: If Redis is down, allow the request
      // This prevents Redis issues from blocking all traffic
      // Log the error for monitoring
      console.error("Rate limit check failed:", error);
      next();
    }
  };
}
