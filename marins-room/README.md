# Marin's Room

A production-grade monorepo implementing a personal website with blogging (MDX), donations (Stripe), video uploads (S3-compatible), and AI-powered real-time chat.

![Marin's Room Homepage](docs/screenshot.png)

## Architecture

```
marins-room/
├── apps/
│   ├── web/          # Next.js frontend (App Router)
│   ├── api/          # Express REST API + WebSocket
│   └── worker/       # Background job runner (stub)
├── packages/
│   ├── shared/       # Shared types, Zod schemas, API client
│   └── config/       # Shared ESLint, Prettier, TypeScript configs
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Features

- **Blog**: MDX-powered blog posts with syntax highlighting
- **Videos**: Upload videos via signed URLs to S3-compatible storage
- **Donations**: Stripe Checkout integration with webhook handling
- **Chat**: Real-time WebSocket chat with AI responses
- **Admin Dashboard**: Server-side protected admin routes

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Visa Nova React
- **Backend**: Express.js, Prisma, PostgreSQL, Redis
- **Real-time**: WebSockets (ws library)
- **Payments**: Stripe Checkout + Webhooks
- **Storage**: S3-compatible (AWS S3 / Cloudflare R2)
- **AI**: OpenAI-compatible API for chat responses

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Quick Start

### 1. Clone and Install

```bash
cd marins-room
pnpm install
```

### 2. Set Up Environment Variables

```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/worker/.env.example apps/worker/.env

# Edit each .env file with your values
```

**Required Environment Variables:**

**apps/api/.env:**
```env
DATABASE_URL="postgresql://marin:marindev123@localhost:5432/marins_room"
REDIS_URL="redis://localhost:6379"
ADMIN_API_KEY=<generate-with-openssl-rand-hex-32>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=marins-room-videos
AI_API_KEY=sk-...
```

**apps/web/.env:**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws/chat
ADMIN_API_KEY=<same-as-api>
```

### 3. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL and Redis.

### 4. Run Database Migrations

```bash
pnpm db:migrate
```

### 5. Start Development Servers

```bash
pnpm dev
```

This starts:
- **Web**: http://localhost:3000
- **API**: http://localhost:4000

## Testing Features

### Donations (Stripe)

1. Navigate to http://localhost:3000/donate
2. Select an amount and fill in details
3. Click "Donate" to redirect to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC

**Webhook Testing (Local):**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:4000/webhooks/stripe

# Copy the webhook secret to your .env
```

### Video Upload

1. Get a signed upload URL (requires admin key):
```bash
curl -X POST http://localhost:4000/uploads/video/signed-url \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "title": "Test Video",
    "description": "A test video",
    "mimeType": "video/mp4",
    "fileSizeBytes": 1000000
  }'
```

2. Upload to the signed URL:
```bash
curl -X PUT "SIGNED_URL_FROM_RESPONSE" \
  -H "Content-Type: video/mp4" \
  --data-binary @your-video.mp4
```

3. Confirm upload:
```bash
curl -X POST http://localhost:4000/videos/VIDEO_ID/confirm-upload \
  -H "x-admin-api-key: YOUR_ADMIN_KEY"
```

### Chat

1. Navigate to http://localhost:3000/chat
2. Click "Start Chat" to begin a session
3. Send messages and receive AI responses

**Admin View:**
1. Navigate to http://localhost:3000/admin
2. View chat sessions and reply as admin

### Blog

Blog posts are stored in `apps/web/content/blog/*.mdx`:

```mdx
---
title: "My Post Title"
description: "A brief description"
date: "2024-01-15"
author: "Marin"
tags: ["tech", "tutorial"]
published: true
---

# Content here

Write your MDX content...
```

## API Endpoints

### Payments
- `POST /payments/checkout-session` - Create Stripe checkout session
- `POST /webhooks/stripe` - Stripe webhook handler

### Donations
- `GET /donations` - List donations (admin)
- `GET /donations/:id` - Get donation details (admin)

### Videos
- `GET /videos` - List public videos
- `GET /videos/:id` - Get video details
- `POST /uploads/video/signed-url` - Get signed upload URL (admin)
- `PATCH /videos/:id/status` - Update video status (admin)
- `POST /videos/:id/confirm-upload` - Confirm upload completed (admin)

### Chat
- `POST /chat/sessions` - Start new chat session
- `POST /chat/messages` - Send message
- `GET /chat/sessions` - List sessions (admin)
- `GET /chat/sessions/:id/messages` - Get session messages
- `POST /chat/sessions/:id/close` - Close session (admin)
- `POST /chat/sessions/:id/reply` - Admin reply to session

### WebSocket
- `ws://localhost:4000/ws/chat` - Real-time chat

## Scripts

```bash
# Development
pnpm dev              # Start web + api
pnpm dev:all          # Start web + api + worker

# Database
pnpm db:migrate       # Run Prisma migrations
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Prisma Studio
pnpm db:generate      # Generate Prisma client

# Build
pnpm build            # Build all packages
pnpm typecheck        # TypeScript check

# Linting & Formatting
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
```

## Project Structure

### apps/api
- `src/routes/` - Express route handlers
- `src/lib/` - Shared utilities (prisma, redis, stripe, s3, ai)
- `src/middleware/` - Express middleware (admin auth, rate limit, validation)
- `src/websocket/` - WebSocket handler
- `prisma/` - Database schema and migrations

### apps/web
- `src/app/` - Next.js App Router pages
- `src/components/` - React components
- `src/lib/` - Client utilities
- `content/blog/` - MDX blog posts

### packages/shared
- `src/types/` - TypeScript type definitions
- `src/schemas/` - Zod validation schemas
- `src/api-client/` - Typed API client

## Security Notes

- Admin routes protected by `ADMIN_API_KEY` header
- Stripe webhooks verified with signature
- Input validation using Zod schemas
- Rate limiting on sensitive endpoints
- CORS restricted to `WEB_ORIGIN`

## TODO

- [ ] Implement video transcoding in worker
- [ ] Add email notifications
- [ ] Set up actual S3/R2 bucket
- [ ] Configure production Stripe keys
- [ ] Add user authentication (OAuth)
- [ ] Implement proper admin authentication
- [ ] Add tests

## License

MIT
