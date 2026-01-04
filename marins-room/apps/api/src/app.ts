/**
 * ============================================================================
 * EXPRESS APPLICATION - Route & Middleware Configuration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file creates and configures the Express application. Express is a
 * web framework that makes it easy to handle HTTP requests.
 *
 * Think of Express like a receptionist:
 *   - Incoming request arrives at the door
 *   - Receptionist (middleware) checks credentials, logs the visit
 *   - Routes it to the right department (route handler)
 *   - Returns the response to the visitor
 *
 * MIDDLEWARE EXPLAINED:
 * ---------------------
 * Middleware are functions that run BEFORE your route handlers.
 * They can:
 *   - Modify the request (add data, parse body)
 *   - Modify the response (add headers)
 *   - End the request early (authentication failed)
 *   - Pass to the next middleware (call next())
 *
 * Middleware run in ORDER they're defined. Like a pipeline:
 *
 *   Request → helmet → cors → json → logger → route → response
 *
 * ORDER OF MIDDLEWARE (VERY IMPORTANT):
 * --------------------------------------
 *   1. helmet() - Security headers (always first)
 *   2. cors() - Cross-origin settings
 *   3. Stripe webhook route (BEFORE json parser - needs raw body!)
 *   4. express.json() - Parse JSON bodies
 *   5. Request logger
 *   6. Route handlers
 *   7. 404 handler (catches unmatched routes)
 *   8. Error handler (catches thrown errors)
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - index.ts: Imports this app and attaches to HTTP server
 * - routes/*: Individual route files imported here
 * - middleware/*: Reusable middleware functions
 * - config/env.ts: Environment variables (for CORS origin)
 */

import cors from "cors";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { chatRouter } from "./routes/chat.js";
import { donationsRouter } from "./routes/donations.js";
import { healthRouter } from "./routes/health.js";
import { paymentsRouter } from "./routes/payments.js";
import { uploadsRouter } from "./routes/uploads.js";
import { videosRouter } from "./routes/videos.js";
import { stripeWebhookRouter } from "./routes/webhooks/stripe.js";

/**
 * Create Express application instance
 *
 * PSEUDOCODE:
 * -----------
 * express() creates a new Express application.
 * This app object is used to:
 *   - Register middleware with app.use()
 *   - Define routes with app.get(), app.post(), etc.
 *   - Export for index.ts to create HTTP server
 */
export const app: Express = express();

/**
 * Helmet - Security Headers
 *
 * PSEUDOCODE:
 * -----------
 * Helmet adds various HTTP security headers:
 *   - X-Content-Type-Options: Prevents MIME type sniffing
 *   - X-Frame-Options: Prevents clickjacking attacks
 *   - X-XSS-Protection: Enables browser XSS filters
 *   - Content-Security-Policy: Controls resource loading
 *   - And many more...
 *
 * These headers protect against common web vulnerabilities.
 * Always put security middleware FIRST.
 */
app.use(helmet());

/**
 * CORS - Cross-Origin Resource Sharing
 *
 * PSEUDOCODE:
 * -----------
 * By default, browsers block requests from one domain to another.
 * For example, localhost:3000 (web) calling localhost:4000 (api).
 *
 * CORS headers tell the browser "it's okay, I trust this origin."
 *
 * Configuration:
 *   - origin: env.WEB_ORIGIN → Only allow requests from our web app
 *   - credentials: true → Allow cookies and auth headers
 *
 * WHY RESTRICT ORIGINS?
 *   - Prevents random websites from calling your API
 *   - Limits attack surface for CSRF attacks
 *   - In production, set WEB_ORIGIN to your actual domain
 */
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  })
);

/**
 * Stripe Webhook Route - MUST BE BEFORE JSON MIDDLEWARE!
 *
 * PSEUDOCODE:
 * -----------
 * Stripe sends webhook requests with a raw body that we need to verify.
 * If we parse it as JSON first, the signature verification fails!
 *
 * This route uses express.raw() instead of express.json().
 * That's why it's registered BEFORE the JSON middleware below.
 *
 * Order matters:
 *   ✅ /webhooks/stripe (raw body) → then JSON middleware
 *   ❌ JSON middleware → then /webhooks/stripe (body already parsed!)
 */
app.use("/webhooks/stripe", stripeWebhookRouter);

/**
 * JSON Body Parser
 *
 * PSEUDOCODE:
 * -----------
 * This middleware:
 *   1. Reads the request body
 *   2. Parses it as JSON
 *   3. Puts the result in req.body
 *
 * Example:
 *   Client sends: '{"amount": 1000}'
 *   After middleware: req.body = { amount: 1000 }
 *
 * Options:
 *   - limit: "10mb" → Reject bodies larger than 10 megabytes
 *     (Prevents denial-of-service attacks with huge payloads)
 */
app.use(express.json({ limit: "10mb" }));

/**
 * Request Logger Middleware
 *
 * PSEUDOCODE:
 * -----------
 * For every request, log:
 *   - HTTP method (GET, POST, etc.)
 *   - Path (/health, /donations, etc.)
 *   - Client IP address
 *
 * Then call next() to continue to the route handler.
 *
 * This is useful for:
 *   - Debugging issues
 *   - Monitoring traffic
 *   - Detecting suspicious activity
 */
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info({
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

/**
 * ============================================================================
 * ROUTE REGISTRATION
 * ============================================================================
 *
 * Each router handles a group of related endpoints:
 *
 *   /health/*     → System health checks (uptime, database status)
 *   /payments/*   → Creating Stripe checkout sessions
 *   /donations/*  → Viewing donation history (admin)
 *   /uploads/*    → Getting signed URLs for video uploads
 *   /videos/*     → Video management
 *   /chat/*       → Chat session and message management
 *
 * The routers are imported from ./routes/*.ts files.
 */
app.use("/health", healthRouter);
app.use("/payments", paymentsRouter);
app.use("/donations", donationsRouter);
app.use("/uploads", uploadsRouter);
app.use("/videos", videosRouter);
app.use("/chat", chatRouter);

/**
 * 404 Handler - Catches Unmatched Routes
 *
 * PSEUDOCODE:
 * -----------
 * If a request makes it past all routes without being handled,
 * this middleware catches it and returns a 404 error.
 *
 * This runs AFTER all routes because of declaration order.
 * Express tries routes in order; if none match, it reaches here.
 *
 * Response format matches our standard ApiResponse structure:
 *   {
 *     success: false,
 *     error: { code: "NOT_FOUND", message: "Endpoint not found" }
 *   }
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Endpoint not found",
    },
  });
});

/**
 * Global Error Handler - Catches All Thrown Errors
 *
 * PSEUDOCODE:
 * -----------
 * If any route handler or middleware throws an error, Express
 * catches it and passes it here (because of the 4-parameter signature).
 *
 * The 4 parameters (err, req, res, next) tell Express this is
 * an error handler, not a regular middleware.
 *
 * Steps:
 *   1. LOG THE ERROR
 *      - Full stack trace for debugging
 *
 *   2. SEND ERROR RESPONSE
 *      - 500 Internal Server Error status
 *      - In production: Hide error details (security)
 *      - In development: Show actual error message
 *
 * WHY HIDE ERRORS IN PRODUCTION?
 *   - Error messages might reveal:
 *     - Database table names
 *     - File paths
 *     - Internal logic
 *   - Attackers could use this information
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  });
});
