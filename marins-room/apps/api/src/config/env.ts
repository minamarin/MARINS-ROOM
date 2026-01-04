/**
 * ============================================================================
 * ENVIRONMENT CONFIGURATION - Validated Environment Variables
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file validates all environment variables at startup using Zod.
 * If any required variable is missing or invalid, the server REFUSES to start.
 *
 * This is much better than finding out about missing config in production!
 *
 * WHY VALIDATE ENVIRONMENT VARIABLES?
 * ------------------------------------
 * Without validation:
 *   1. Server starts up normally
 *   2. User tries to donate
 *   3. Code tries to use STRIPE_SECRET_KEY
 *   4. CRASH! "Cannot read property 'undefined'"
 *   5. You spend hours debugging
 *
 * With validation:
 *   1. Server tries to start
 *   2. "STRIPE_SECRET_KEY is missing!"
 *   3. You fix .env file
 *   4. Server starts correctly
 *
 * HOW TO ADD A NEW VARIABLE:
 * --------------------------
 * 1. Add it to the schema below with appropriate Zod validation
 * 2. Add it to your .env file
 * 3. The `env` object will have type-safe access to it
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - index.ts: Loads .env file BEFORE importing this
 * - All other files: Import `env` object for config values
 * - Zod library: Provides schema validation
 */

import { z } from "zod";

/**
 * envSchema - Defines the shape and validation rules for environment variables
 *
 * PSEUDOCODE:
 * -----------
 * Each field describes one environment variable:
 *   - Name matches the env var name exactly
 *   - Zod type specifies the expected type
 *   - .default() provides a fallback value
 *   - No .default() means the variable is REQUIRED
 *
 * VALIDATION RULES EXPLAINED:
 *
 * z.enum([...]) → Must be one of the listed values
 * z.string() → Must be a string
 * z.string().url() → Must be a valid URL
 * z.string().min(N) → Must be at least N characters
 * z.string().startsWith("X") → Must start with "X"
 * z.coerce.number() → Convert string to number
 * .default(X) → Use X if not provided
 */
const envSchema = z.object({
  /**
   * NODE_ENV - The runtime environment
   *
   * Values:
   *   - development: Local development (verbose logs, error details)
   *   - production: Live server (minimal logs, hidden errors)
   *   - test: Running tests (may use test database)
   */
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * PORT - Which port the server listens on
   *
   * z.coerce.number() converts the string "4000" to the number 4000
   * (Environment variables are always strings)
   */
  PORT: z.coerce.number().default(4000),

  /**
   * WEB_ORIGIN - The URL of our frontend web app
   *
   * Used for CORS configuration. Only requests from this origin are allowed.
   * In production, this would be "https://yourdomain.com"
   */
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  // =========================================================================
  // DATABASE
  // =========================================================================

  /**
   * DATABASE_URL - PostgreSQL connection string
   *
   * Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   * Example: postgresql://postgres:password@localhost:5432/marins_room
   *
   * No default - database is REQUIRED for the app to function.
   */
  DATABASE_URL: z.string().url(),

  // =========================================================================
  // REDIS
  // =========================================================================

  /**
   * REDIS_URL - Redis connection string
   *
   * Format: redis://HOST:PORT
   * Used for rate limiting and caching.
   */
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  // =========================================================================
  // ADMIN AUTHENTICATION
  // =========================================================================

  /**
   * ADMIN_API_KEY - Secret key for admin endpoints
   *
   * SECURITY:
   *   - Must be at least 32 characters (for security)
   *   - Never expose this in frontend code!
   *   - Generate with: openssl rand -hex 32
   *
   * Used by requireAdmin middleware to protect admin routes.
   */
  ADMIN_API_KEY: z.string().min(32),

  // =========================================================================
  // STRIPE (Payment Processing)
  // =========================================================================

  /**
   * STRIPE_SECRET_KEY - Your Stripe API secret key
   *
   * Format: sk_test_... or sk_live_...
   * The startsWith("sk_") check ensures you don't accidentally use a public key.
   *
   * Get this from: https://dashboard.stripe.com/apikeys
   */
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),

  /**
   * STRIPE_WEBHOOK_SECRET - Secret for verifying Stripe webhooks
   *
   * Format: whsec_...
   * Used to verify that webhook requests actually came from Stripe.
   *
   * Get this from: https://dashboard.stripe.com/webhooks
   */
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // =========================================================================
  // S3-COMPATIBLE STORAGE (Video Uploads)
  // =========================================================================

  /**
   * S3_ENDPOINT - The S3-compatible storage endpoint
   *
   * Can be:
   *   - AWS S3: https://s3.amazonaws.com
   *   - MinIO: http://localhost:9000
   *   - Cloudflare R2: https://xxxx.r2.cloudflarestorage.com
   *   - DigitalOcean Spaces: https://nyc3.digitaloceanspaces.com
   */
  S3_ENDPOINT: z.string().url(),

  /**
   * S3_REGION - The storage region
   *
   * AWS regions: us-east-1, eu-west-1, etc.
   * For MinIO/local: can be any value (default: us-east-1)
   */
  S3_REGION: z.string().default("us-east-1"),

  /**
   * S3_ACCESS_KEY_ID - Access key for S3 authentication
   */
  S3_ACCESS_KEY_ID: z.string().min(1),

  /**
   * S3_SECRET_ACCESS_KEY - Secret key for S3 authentication
   *
   * SECURITY: Never expose this! Keep it in .env only.
   */
  S3_SECRET_ACCESS_KEY: z.string().min(1),

  /**
   * S3_BUCKET_NAME - The bucket to store videos in
   *
   * Must exist before the app can upload to it.
   */
  S3_BUCKET_NAME: z.string().min(1),

  // =========================================================================
  // AI CHAT
  // =========================================================================

  /**
   * AI_API_URL - The AI API endpoint URL
   *
   * Default is OpenAI, but can be any compatible API:
   *   - OpenAI: https://api.openai.com/v1
   *   - Azure OpenAI: https://xxx.openai.azure.com
   *   - Local models: http://localhost:11434/v1 (Ollama)
   */
  AI_API_URL: z.string().url().default("https://api.openai.com/v1"),

  /**
   * AI_API_KEY - API key for the AI service
   */
  AI_API_KEY: z.string().min(1),

  /**
   * AI_MODEL - Which model to use for chat responses
   *
   * Examples: gpt-4o-mini, gpt-4o, claude-3-sonnet, etc.
   */
  AI_MODEL: z.string().default("gpt-4o-mini"),
});

/**
 * validateEnv() - Validates process.env against the schema
 *
 * PSEUDOCODE:
 * -----------
 * 1. Take all environment variables from process.env
 * 2. Parse them against the schema
 * 3. If any fail validation:
 *    - Log which variables are invalid
 *    - Throw an error (stops server startup)
 * 4. If all pass:
 *    - Return the validated, typed object
 *
 * WHY safeParse?
 *   - .parse() throws on error (hard to catch)
 *   - .safeParse() returns { success: boolean, data/error }
 *   - We can give a nice error message before throwing
 */
function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Print helpful error message
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    // Stop the server - don't run with missing config!
    throw new Error("Invalid environment variables");
  }

  // Return validated data with proper TypeScript types
  return parsed.data;
}

/**
 * Validated environment variables
 *
 * USAGE:
 * ------
 * import { env } from "./config/env.js";
 *
 * // TypeScript knows env.PORT is a number
 * server.listen(env.PORT);
 *
 * // TypeScript knows env.STRIPE_SECRET_KEY is a string
 * const stripe = new Stripe(env.STRIPE_SECRET_KEY);
 *
 * The env object is created once at import time.
 * If validation fails, the app crashes before any routes are set up.
 */
export const env = validateEnv();
