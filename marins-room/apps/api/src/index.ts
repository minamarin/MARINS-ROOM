/**
 * ============================================================================
 * API SERVER ENTRY POINT - Where Everything Starts
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This is the main entry point for the backend API server. When you run
 * `pnpm dev` in the api folder, Node.js loads THIS file first.
 *
 * It orchestrates the startup sequence:
 *   1. Load environment variables
 *   2. Create the HTTP server
 *   3. Attach WebSocket support
 *   4. Set up graceful shutdown handlers
 *   5. Start listening for requests
 *
 * WHY THIS STRUCTURE:
 * -------------------
 * Separation of concerns:
 *   - index.ts: Server lifecycle (start, stop)
 *   - app.ts: Express configuration (routes, middleware)
 *   - lib/*: Reusable utilities (database, redis, etc.)
 *
 * This makes testing easier - you can import `app` without starting a server.
 *
 * STARTUP FLOW:
 * -------------
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │                      node src/index.ts                       │
 *   └──────────────────────────┬───────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  1. import "dotenv/config"                                   │
 *   │     - Loads .env file into process.env                       │
 *   │     - This MUST be first (other files need env vars)         │
 *   └──────────────────────────┬───────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  2. Import app, env, logger, prisma, redis, websocket        │
 *   │     - Each import initializes its connection                 │
 *   │     - Prisma connects to PostgreSQL                          │
 *   │     - Redis connects to cache server                         │
 *   └──────────────────────────┬───────────────────────────────────┘
 *                              │
 *                              ▼
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  3. main() function runs:                                    │
 *   │     - Creates HTTP server from Express app                   │
 *   │     - Attaches WebSocket handler                             │
 *   │     - Registers shutdown handlers                            │
 *   │     - Starts listening on PORT                               │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - app.ts: Exports configured Express application
 * - config/env.ts: Validated environment variables
 * - lib/*: Database, cache, and utility connections
 * - websocket/index.ts: WebSocket server setup
 */

// CRITICAL: Load .env file FIRST before any other imports
// This populates process.env with values from .env file
// Other files (like env.ts) read from process.env during import
import "dotenv/config";

import { createServer } from "http";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { setupWebSocket } from "./websocket/index.js";

/**
 * main() - The main startup function
 *
 * PSEUDOCODE:
 * -----------
 * This is an async function because we need to await shutdown operations.
 *
 * STEPS:
 *
 * 1. CREATE HTTP SERVER
 *    - Node's createServer() wraps the Express app
 *    - This allows WebSocket to attach to the same server
 *    - Express handles HTTP, WebSocket handles WS on same port
 *
 * 2. SETUP WEBSOCKET
 *    - Attach WebSocket server to HTTP server
 *    - Clients connect via ws://localhost:4000/ws/chat
 *
 * 3. DEFINE SHUTDOWN HANDLER
 *    - Handles SIGINT (Ctrl+C) and SIGTERM (kill command)
 *    - Closes connections gracefully before exiting
 *    - Important for Kubernetes/Docker container management
 *
 * 4. REGISTER SHUTDOWN SIGNALS
 *    - process.on("SIGINT", ...) - When you press Ctrl+C
 *    - process.on("SIGTERM", ...) - When container/process is killed
 *
 * 5. START LISTENING
 *    - server.listen() binds to the port
 *    - Logs startup message with port and environment
 *    - Server is now ready for requests!
 *
 * WHY async/await?
 *    - Database and Redis disconnection are async operations
 *    - We want to ensure clean disconnection before exiting
 */
async function main() {
  // STEP 1: Create HTTP server from Express app
  // Node's HTTP server is needed for WebSocket support
  // Express app alone only handles HTTP, not WebSocket
  const server = createServer(app);

  // STEP 2: Attach WebSocket to the server
  // WebSocket allows real-time bidirectional communication
  // Used for chat feature - messages appear instantly without refreshing
  setupWebSocket(server);

  /**
   * shutdown() - Clean shutdown function
   *
   * PSEUDOCODE:
   * -----------
   * When the server receives a signal to stop:
   *
   * 1. LOG THE SIGNAL
   *    - So we know why the server is stopping
   *
   * 2. CLOSE HTTP SERVER
   *    - Stop accepting new connections
   *    - Wait for existing requests to finish
   *
   * 3. DISCONNECT DATABASE
   *    - Close PostgreSQL connection pool
   *    - Releases database connections for other processes
   *
   * 4. DISCONNECT REDIS
   *    - Close Redis connection
   *    - Important for connection limits
   *
   * 5. EXIT PROCESS
   *    - process.exit(0) = clean exit
   *    - 0 means "success" (non-zero means error)
   *
   * WHY GRACEFUL SHUTDOWN?
   *    - Prevents data corruption mid-transaction
   *    - Allows clients to finish current requests
   *    - Required for zero-downtime deployments
   */
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new HTTP connections
    // Callback runs when all existing connections are closed
    server.close(() => {
      logger.info("HTTP server closed");
    });

    // Close Prisma database connection pool
    await prisma.$disconnect();
    logger.info("Database connection closed");

    // Close Redis connection
    await redis.quit();
    logger.info("Redis connection closed");

    // Exit with success code
    process.exit(0);
  };

  // STEP 4: Register signal handlers
  // SIGINT = User pressed Ctrl+C
  process.on("SIGINT", () => shutdown("SIGINT"));
  // SIGTERM = Process manager (Docker, Kubernetes) requested shutdown
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // STEP 5: Start the server!
  // server.listen() starts accepting connections
  // The callback runs once the server is ready
  server.listen(env.PORT, () => {
    logger.info(`API server running on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`WebSocket available at ws://localhost:${env.PORT}/ws/chat`);
  });
}

/**
 * Error handling for main()
 *
 * PSEUDOCODE:
 * -----------
 * If main() throws an error (e.g., can't connect to database):
 *   1. Log the error
 *   2. Exit with error code (1)
 *
 * Common startup failures:
 *   - Database not running
 *   - Redis not running
 *   - Invalid environment variables
 *   - Port already in use
 */
main().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
