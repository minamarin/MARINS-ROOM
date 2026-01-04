/**
 * ============================================================================
 * VALIDATION MIDDLEWARE - Request Data Validation with Zod
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file provides middleware factories for validating different parts
 * of HTTP requests using Zod schemas.
 *
 * Three validation targets:
 *   - Body: The JSON data sent with POST/PUT/PATCH requests
 *   - Query: URL parameters after ? (e.g., /items?page=2&limit=10)
 *   - Params: URL path parameters (e.g., /users/:id → req.params.id)
 *
 * WHAT IS A MIDDLEWARE FACTORY?
 * -----------------------------
 * A function that RETURNS a middleware function.
 *
 * Normal middleware:
 *   function logRequest(req, res, next) { ... }
 *
 * Middleware factory:
 *   function validateBody(schema) {
 *     return function(req, res, next) { ... }
 *   }
 *
 * The factory pattern lets us customize the middleware:
 *   validateBody(CreateDonationSchema)  // Different schemas
 *   validateBody(CreateVideoSchema)     // for different routes
 *
 * HOW VALIDATION WORKS:
 * ---------------------
 *
 *   Request arrives with data
 *          │
 *          ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                    VALIDATE MIDDLEWARE                          │
 *   │                                                                 │
 *   │  schema.safeParse(req.body)                                    │
 *   │    │                                                           │
 *   │    ├─→ SUCCESS: req.body = validated data, call next()        │
 *   │    │                                                           │
 *   │    └─→ FAILURE: return 400 with validation errors              │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * WHY USE safeParse?
 * ------------------
 * .parse(data) throws an error if validation fails.
 * .safeParse(data) returns { success: boolean, data/error }.
 *
 * safeParse is better for HTTP because:
 *   - We can return a proper 400 response
 *   - We include detailed error info
 *   - No need for try/catch
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - Uses Zod schemas from @repo/shared/schemas
 * - Used by route files to validate incoming requests
 * - Follows same error format as other middleware
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

/**
 * validateBody - Factory for request body validation middleware
 *
 * PSEUDOCODE:
 * -----------
 * INPUT:
 *   - schema: A Zod schema that describes valid body shape
 *
 * RETURNS:
 *   - Express middleware function
 *
 * THE RETURNED MIDDLEWARE:
 *   1. Parse req.body using the schema
 *   2. If valid:
 *      - Replace req.body with validated/transformed data
 *        (Zod can transform data, e.g., string → number)
 *      - Call next() to continue
 *   3. If invalid:
 *      - Return 400 Bad Request
 *      - Include error details in response
 *
 * USAGE EXAMPLE:
 * --------------
 * import { validateBody } from "../middleware/validate.js";
 * import { CreateDonationSchema } from "@repo/shared/schemas";
 *
 * router.post(
 *   "/donations",
 *   validateBody(CreateDonationSchema),  // Validates body
 *   async (req, res) => {
 *     // req.body is now typed and validated!
 *     const { amount, email } = req.body;
 *   }
 * );
 *
 * ERROR RESPONSE FORMAT:
 * ----------------------
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "Invalid request body",
 *     "details": {
 *       "fieldErrors": {
 *         "amount": ["Expected number, received string"]
 *       }
 *     }
 *   }
 * }
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Attempt to parse the request body against the schema
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Validation failed - return 400 with error details
      // .flatten() converts Zod's error format to a simpler structure
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: result.error.flatten(),
        },
      });
    }

    // Validation passed - replace body with validated data
    // This is important because Zod may have transformed values
    // (e.g., applied .default() or .transform())
    req.body = result.data;
    next();
  };
}

/**
 * validateQuery - Factory for query parameter validation middleware
 *
 * PSEUDOCODE:
 * -----------
 * Same as validateBody, but validates req.query instead.
 *
 * IMPORTANT DIFFERENCE:
 * Query parameters are always STRINGS from the URL.
 * Use z.coerce.number() in schema to convert "5" → 5.
 *
 * USAGE EXAMPLE:
 * --------------
 * const PaginationSchema = z.object({
 *   page: z.coerce.number().default(1),     // "2" → 2
 *   limit: z.coerce.number().default(20),   // "10" → 10
 * });
 *
 * router.get(
 *   "/donations",
 *   validateQuery(PaginationSchema),
 *   async (req, res) => {
 *     const { page, limit } = req.query;
 *     // page and limit are now numbers!
 *   }
 * );
 *
 * EXAMPLE URL:
 *   GET /donations?page=2&limit=10
 *   → req.query = { page: 2, limit: 10 }
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: result.error.flatten(),
        },
      });
    }

    // Type assertion needed because Express types req.query as
    // Record<string, string | string[]>, but we've validated it
    req.query = result.data as typeof req.query;
    next();
  };
}

/**
 * validateParams - Factory for URL path parameter validation middleware
 *
 * PSEUDOCODE:
 * -----------
 * Same as validateBody, but validates req.params instead.
 *
 * URL PATH PARAMETERS:
 * Route: /users/:id
 * URL:   /users/abc-123
 * Result: req.params.id = "abc-123"
 *
 * COMMON USE CASE:
 * Validating that an ID parameter is a valid UUID:
 *
 *   const IdSchema = z.object({
 *     id: z.string().uuid(),
 *   });
 *
 *   router.get(
 *     "/donations/:id",
 *     validateParams(IdSchema),
 *     async (req, res) => {
 *       // req.params.id is guaranteed to be a valid UUID
 *     }
 *   );
 *
 * EXAMPLE:
 *   GET /donations/invalid-id
 *   → 400 error: "id must be a valid UUID"
 *
 *   GET /donations/a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *   → continues to route handler
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid path parameters",
          details: result.error.flatten(),
        },
      });
    }

    req.params = result.data as typeof req.params;
    next();
  };
}
