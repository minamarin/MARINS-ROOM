/**
 * ============================================================================
 * REDIS CLIENT - In-Memory Cache and Rate Limiting
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file sets up a connection to Redis and provides utilities for
 * rate limiting. Redis is an in-memory database - incredibly fast for
 * operations that need to happen on every request.
 *
 * WHAT IS REDIS?
 * --------------
 * Redis is like a super-fast key-value store that keeps data in RAM.
 * Perfect for:
 *   - Rate limiting (counting requests)
 *   - Caching (storing frequently accessed data)
 *   - Session storage
 *   - Real-time leaderboards
 *   - Pub/sub messaging
 *
 * WHY REDIS FOR RATE LIMITING?
 * ----------------------------
 * Rate limiting needs to:
 *   1. Run on EVERY request (must be fast)
 *   2. Share state across server instances
 *   3. Automatically expire old data
 *
 * Redis is perfect because:
 *   - In-memory = microsecond response times
 *   - Shared = all servers see the same counts
 *   - Built-in TTL (time-to-live) for expiration
 *   - Atomic operations prevent race conditions
 *
 * SLIDING WINDOW RATE LIMITING:
 * -----------------------------
 * We use a "sliding window" approach, which is more fair than fixed windows:
 *
 * Fixed Window (simpler, but burstable):
 *   [  Window 1  ][  Window 2  ]
 *   |--- 60s ---|
 *   User can hit 100 req at :59 and 100 more at :01 = 200 in 2 seconds!
 *
 * Sliding Window (we use this):
 *   Every request is counted for 60 seconds from when it was made.
 *   The "window" slides with time, preventing burst abuse.
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - config/env.ts: Provides REDIS_URL
 * - middleware/rateLimit.ts: Uses checkRateLimit function
 * - index.ts: Closes connection on shutdown
 */

import Redis from "ioredis";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

/**
 * Redis client instance
 *
 * PSEUDOCODE:
 * -----------
 * Create a new Redis connection with:
 *
 *   maxRetriesPerRequest: 3
 *     - If a command fails, retry up to 3 times
 *     - After 3 failures, the command throws an error
 *
 *   lazyConnect: true
 *     - Don't connect immediately on import
 *     - Connect on first actual command
 *     - Helps with startup timing
 *
 * The connection URL (redis://host:port) is from environment variables.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

/**
 * Connection event handlers
 *
 * PSEUDOCODE:
 * -----------
 * Redis client emits events we can listen to:
 *
 *   "connect" - Successfully connected to Redis
 *               Log it so we know everything is working
 *
 *   "error" - Something went wrong
 *             Log it for debugging (network issues, auth failure, etc.)
 */
redis.on("connect", () => {
  logger.info("Connected to Redis");
});

redis.on("error", (error) => {
  logger.error("Redis error:", error);
});

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

/**
 * RateLimitResult - What the rate limiter returns
 *
 * PSEUDOCODE:
 * -----------
 *   allowed: Can this request proceed?
 *            true = under limit, go ahead
 *            false = over limit, reject
 *
 *   remaining: How many requests left in current window?
 *              Shown to client in X-RateLimit-Remaining header
 *
 *   resetIn: Seconds until the window resets
 *            Shown to client in X-RateLimit-Reset header
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * checkRateLimit - Sliding window rate limiter using Redis sorted sets
 *
 * PSEUDOCODE:
 * -----------
 * INPUT:
 *   - key: Unique identifier (e.g., "chat:192.168.1.1")
 *   - limit: Maximum requests allowed (e.g., 100)
 *   - windowSeconds: Time window in seconds (e.g., 60)
 *
 * OUTPUT:
 *   - { allowed, remaining, resetIn }
 *
 * HOW IT WORKS:
 *
 * We use a Redis SORTED SET where:
 *   - Each request is a member with timestamp as score
 *   - Score = when the request was made (milliseconds)
 *   - Member = unique ID (timestamp + random to prevent collisions)
 *
 * ALGORITHM:
 *
 * 1. CALCULATE WINDOW BOUNDARIES
 *    now = current timestamp
 *    windowStart = now - (60 seconds * 1000 ms)
 *
 * 2. REMOVE OLD ENTRIES
 *    ZREMRANGEBYSCORE key -infinity windowStart
 *    This removes all entries older than the window
 *
 * 3. COUNT CURRENT ENTRIES
 *    ZCARD key
 *    Returns how many requests in the current window
 *
 * 4. ADD NEW REQUEST
 *    ZADD key now "unique-id"
 *    Adds current request to the set
 *
 * 5. SET EXPIRY
 *    EXPIRE key windowSeconds
 *    Cleans up the key if no requests for a full window
 *
 * 6. CHECK RESULT
 *    If count < limit: allowed!
 *    If count >= limit: rate limited!
 *
 * WHY A TRANSACTION (MULTI/EXEC)?
 *   - All operations happen atomically
 *   - No race conditions between checking and adding
 *   - Either all succeed or all fail
 *
 * EXAMPLE:
 *   Window: 60 seconds, Limit: 100
 *   Key: "chat:192.168.1.1"
 *
 *   Request 1: count=0, allowed=true, remaining=99
 *   Request 2: count=1, allowed=true, remaining=98
 *   ...
 *   Request 100: count=99, allowed=true, remaining=0
 *   Request 101: count=100, allowed=false ← RATE LIMITED!
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  // STEP 1: Calculate time boundaries
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  // STEP 2-5: Execute all operations in a transaction
  // multi() starts a transaction, exec() runs it
  const multi = redis.multi();

  // Remove entries outside the current window (older than windowStart)
  // ZREMRANGEBYSCORE removes sorted set members with scores in a range
  multi.zremrangebyscore(redisKey, "-inf", windowStart);

  // Count how many entries remain in the window
  // ZCARD returns the number of members in a sorted set
  multi.zcard(redisKey);

  // Add the current request with timestamp as score
  // Random suffix prevents duplicates if two requests have same timestamp
  multi.zadd(redisKey, now, `${now}-${Math.random()}`);

  // Set key to expire after the window duration
  // This cleans up keys for inactive users automatically
  multi.expire(redisKey, windowSeconds);

  // Execute all commands atomically
  const results = await multi.exec();

  // Handle transaction failure (shouldn't happen normally)
  if (!results) {
    throw new Error("Redis transaction failed");
  }

  // STEP 6: Calculate result
  // results[1] is the ZCARD result (count of entries)
  // Results are in format [error, value], so we get [1] for value
  const count = (results[1]?.[1] as number) || 0;
  const allowed = count < limit;

  return {
    allowed,
    // remaining = limit - count - 1 (we just added one)
    // Math.max(0, ...) ensures we don't go negative
    remaining: Math.max(0, limit - count - 1),
    resetIn: windowSeconds,
  };
}
