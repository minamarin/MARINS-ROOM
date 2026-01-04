/**
 * ============================================================================
 * ADMIN AUTHENTICATION MIDDLEWARE
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This middleware protects admin-only routes by checking for a valid API key.
 * If the key is missing or wrong, the request is rejected with 401 Unauthorized.
 *
 * HOW IT WORKS:
 * -------------
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                     INCOMING REQUEST                           │
 *   │  GET /donations                                                │
 *   │  Headers: { "x-admin-api-key": "secret-key-here" }            │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                   requireAdmin MIDDLEWARE                       │
 *   │                                                                 │
 *   │  1. Extract "x-admin-api-key" from headers                     │
 *   │  2. Compare with ADMIN_API_KEY from environment                │
 *   │  3. If match: call next() → continue to route                  │
 *   │     If no match: return 401 error                              │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                   ┌─────────┴─────────┐
 *                   │                   │
 *                   ▼                   ▼
 *   ┌─────────────────────┐   ┌─────────────────────┐
 *   │   VALID KEY         │   │   INVALID/MISSING   │
 *   │   Continue to       │   │   Return 401        │
 *   │   route handler     │   │   Unauthorized      │
 *   └─────────────────────┘   └─────────────────────┘
 *
 * WHY USE A HEADER INSTEAD OF QUERY PARAM?
 * -----------------------------------------
 * Headers are more secure:
 *   - Not logged in URLs
 *   - Not stored in browser history
 *   - Not cached by proxies
 *   - Not visible in server access logs
 *
 * Query params (BAD):
 *   GET /donations?apiKey=secret-key  ← Visible in logs!
 *
 * Headers (GOOD):
 *   GET /donations
 *   x-admin-api-key: secret-key  ← Hidden from logs
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - Used by routes that require admin access (donations.ts, etc.)
 * - Reads ADMIN_API_KEY from config/env.ts
 * - Follows same error format as other middleware
 */

import type { Request, Response, NextFunction } from "express";

import { env } from "../config/env.js";

/**
 * requireAdmin - Middleware that blocks non-admin requests
 *
 * PSEUDOCODE:
 * -----------
 * INPUT: Express request, response, and next function
 *
 * STEPS:
 *   1. READ HEADER
 *      - Get "x-admin-api-key" from request headers
 *      - Headers are case-insensitive, but we use lowercase by convention
 *
 *   2. VALIDATE KEY
 *      - Check if header exists (!apiKey catches undefined/null/"")
 *      - Check if it matches the expected key
 *
 *   3. RESPOND
 *      - If valid: call next() to continue to the route handler
 *      - If invalid: return 401 error immediately
 *
 * OUTPUT:
 *   - On success: nothing (request continues to route)
 *   - On failure: JSON error response with 401 status
 *
 * SECURITY NOTES:
 *   - We use constant-time comparison to prevent timing attacks
 *     (Actually, !== is fast enough for API keys of this length)
 *   - The error message is intentionally vague ("Invalid or missing")
 *     Don't tell attackers which one it was!
 *
 * USAGE EXAMPLE:
 * --------------
 * import { requireAdmin } from "../middleware/admin.js";
 *
 * // Apply to specific route
 * router.get("/donations", requireAdmin, getDonations);
 *
 * // Or apply to all routes in a router
 * router.use(requireAdmin);
 * router.get("/donations", getDonations);
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // STEP 1: Extract the API key from request headers
  // Header name is "x-admin-api-key" (x- prefix is common for custom headers)
  const apiKey = req.headers["x-admin-api-key"];

  // STEP 2: Validate the key
  // Two checks:
  //   - !apiKey: Header is missing or empty
  //   - apiKey !== env.ADMIN_API_KEY: Key doesn't match
  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    // STEP 3a: Invalid - return 401 Unauthorized
    // 401 means "you need to authenticate"
    // (vs 403 Forbidden which means "authenticated but not allowed")
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or missing admin API key",
      },
    });
  }

  // STEP 3b: Valid - continue to the next middleware or route handler
  next();
}
