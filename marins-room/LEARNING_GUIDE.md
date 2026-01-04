# Marin's Room - Learning Guide

Welcome! This guide will help you understand how this codebase works, step by step.
If you're new to web development, start from the beginning. Each section builds on the previous one.

---

## Table of Contents

1. [What is This Project?](#what-is-this-project)
2. [Architecture Overview](#architecture-overview)
3. [How Data Flows](#how-data-flows)
4. [Folder Structure](#folder-structure)
5. [Reading Order](#reading-order)
6. [File Dependencies](#file-dependencies)
7. [Key Concepts Explained](#key-concepts-explained)

---

## What is This Project?

**Marin's Room** is a personal website with these features:
- **Blog** - Write and display blog posts using MDX (Markdown + React)
- **Videos** - Upload and watch videos (stored in cloud storage)
- **Donations** - Accept payments via Stripe
- **Chat** - Real-time chat with an AI assistant

This is a **monorepo** - meaning multiple related projects live in one repository.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MONOREPO STRUCTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   apps/web      │    │   apps/api      │    │  apps/worker    │         │
│  │   (Frontend)    │    │   (Backend)     │    │  (Background)   │         │
│  │                 │    │                 │    │                 │         │
│  │  Next.js        │◄──►│  Express.js     │◄──►│  BullMQ         │         │
│  │  React          │    │  Prisma         │    │  Job Queue      │         │
│  │  Tailwind       │    │  WebSocket      │    │                 │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           └──────────────────────┼──────────────────────┘                   │
│                                  │                                          │
│                    ┌─────────────┴─────────────┐                            │
│                    │     packages/shared       │                            │
│                    │  (Shared Code & Types)    │                            │
│                    │                           │                            │
│                    │  - TypeScript Types       │                            │
│                    │  - Zod Schemas            │                            │
│                    │  - API Client             │                            │
│                    └───────────────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              EXTERNAL SERVICES
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  PostgreSQL  │  │    Redis     │  │    Stripe    │  │   S3/R2      │    │
│  │  (Database)  │  │   (Cache)    │  │  (Payments)  │  │  (Storage)   │    │
│  │              │  │              │  │              │  │              │    │
│  │ Stores:      │  │ Used for:    │  │ Handles:     │  │ Stores:      │    │
│  │ - Users      │  │ - Rate limit │  │ - Checkout   │  │ - Videos     │    │
│  │ - Donations  │  │ - Sessions   │  │ - Webhooks   │  │ - Thumbnails │    │
│  │ - Videos     │  │ - Pub/Sub    │  │ - Payments   │  │              │    │
│  │ - Chat       │  │              │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How Data Flows

### 1. User Visits Website (Reading Data)

```
┌──────────┐     HTTP Request      ┌──────────┐     SQL Query      ┌──────────┐
│  Browser │ ──────────────────►   │  Next.js │ ─────────────────► │ Postgres │
│          │                       │  (web)   │                    │          │
│          │ ◄────────────────── │          │ ◄───────────────── │          │
└──────────┘     HTML/JSON         └──────────┘     Data           └──────────┘

Step by step:
1. User types URL in browser (e.g., localhost:3000/blog)
2. Browser sends HTTP GET request to Next.js server
3. Next.js server-side code fetches data from API or database
4. Data is rendered into HTML
5. HTML is sent back to browser
6. Browser displays the page
```

### 2. User Makes a Donation (Writing Data)

```
┌──────────┐   1. Click Donate    ┌──────────┐   2. Create Session  ┌──────────┐
│  Browser │ ─────────────────►   │   API    │ ──────────────────►  │  Stripe  │
│          │                      │          │                      │          │
│          │   5. Show Success    │          │   3. Return URL      │          │
│          │ ◄─────────────────   │          │ ◄──────────────────  │          │
└──────────┘                      └──────────┘                      └──────────┘
     │                                 ▲                                 │
     │    4. Redirect to Stripe        │     6. Webhook (payment done)   │
     └─────────────────────────────────┼─────────────────────────────────┘
                                       │
                                       ▼
                                 ┌──────────┐
                                 │ Postgres │  7. Update donation
                                 │          │     status to CONFIRMED
                                 └──────────┘

Step by step:
1. User clicks "Donate $10" button
2. Frontend calls API: POST /payments/checkout-session
3. API creates a Stripe Checkout session
4. API returns Stripe URL, browser redirects user to Stripe
5. User enters card info on Stripe's secure page
6. After payment, Stripe sends webhook to our API
7. API updates donation status in database
8. User is redirected to success page
```

### 3. Real-Time Chat (WebSocket)

```
┌──────────┐                      ┌──────────┐                      ┌──────────┐
│  Browser │                      │   API    │                      │    AI    │
│          │   1. Connect WS      │ WebSocket│                      │  (GPT)   │
│          │ ─────────────────►   │  Server  │                      │          │
│          │                      │          │                      │          │
│          │   2. Send Message    │          │   3. Get Response    │          │
│          │ ─────────────────►   │          │ ──────────────────►  │          │
│          │                      │          │                      │          │
│          │   5. Receive Reply   │          │   4. AI Response     │          │
│          │ ◄─────────────────   │          │ ◄──────────────────  │          │
└──────────┘                      └──────────┘                      └──────────┘
                                       │
                                       ▼
                                 ┌──────────┐
                                 │ Postgres │  Save messages
                                 └──────────┘

Step by step:
1. User opens chat page, WebSocket connection established
2. User types message, sent via WebSocket (not HTTP!)
3. Server receives message, saves to database
4. Server calls AI API (OpenAI) for response
5. AI response sent back via WebSocket in real-time
6. Browser displays message instantly (no page refresh)
```

### 4. Video Upload (Signed URLs)

```
┌──────────┐   1. Request URL     ┌──────────┐   2. Generate URL    ┌──────────┐
│  Browser │ ─────────────────►   │   API    │ ──────────────────►  │   S3     │
│          │                      │          │                      │          │
│          │   3. Signed URL      │          │                      │          │
│          │ ◄─────────────────   │          │                      │          │
│          │                      └──────────┘                      │          │
│          │   4. Upload directly to S3                             │          │
│          │ ────────────────────────────────────────────────────►  │          │
└──────────┘                                                        └──────────┘

Why signed URLs?
- Large files (videos) shouldn't go through our server
- Signed URL = temporary permission to upload directly to S3
- More efficient, faster uploads
- Our server never handles the large file
```

---

## Folder Structure

```
marins-room/
│
├── apps/                          # APPLICATION CODE
│   │
│   ├── web/                       # FRONTEND (Next.js)
│   │   ├── src/
│   │   │   ├── app/              # Pages (App Router)
│   │   │   │   ├── page.tsx      # Homepage (/)
│   │   │   │   ├── layout.tsx    # Root layout (wraps all pages)
│   │   │   │   ├── globals.css   # Global styles
│   │   │   │   ├── blog/         # Blog pages
│   │   │   │   ├── videos/       # Video pages
│   │   │   │   ├── donate/       # Donation pages
│   │   │   │   ├── chat/         # Chat page
│   │   │   │   └── admin/        # Admin dashboard
│   │   │   ├── components/       # Reusable React components
│   │   │   └── lib/              # Utility functions
│   │   ├── content/
│   │   │   └── blog/             # MDX blog posts
│   │   └── package.json          # Frontend dependencies
│   │
│   ├── api/                       # BACKEND (Express)
│   │   ├── src/
│   │   │   ├── index.ts          # Server entry point
│   │   │   ├── app.ts            # Express app setup
│   │   │   ├── routes/           # API endpoints
│   │   │   │   ├── health.ts     # Health check
│   │   │   │   ├── payments.ts   # Stripe checkout
│   │   │   │   ├── donations.ts  # Donation queries
│   │   │   │   ├── videos.ts     # Video CRUD
│   │   │   │   ├── uploads.ts    # Signed URL generation
│   │   │   │   ├── chat.ts       # Chat sessions
│   │   │   │   └── webhooks/     # External webhooks
│   │   │   ├── middleware/       # Request processing
│   │   │   ├── lib/              # Utilities (DB, Redis, etc.)
│   │   │   └── websocket/        # Real-time chat
│   │   ├── prisma/
│   │   │   └── schema.prisma     # Database schema
│   │   └── package.json          # Backend dependencies
│   │
│   └── worker/                    # BACKGROUND JOBS
│       ├── src/
│       │   └── index.ts          # Job processors
│       └── package.json
│
├── packages/                      # SHARED CODE
│   │
│   ├── shared/                    # Types, schemas, API client
│   │   └── src/
│   │       ├── types/            # TypeScript type definitions
│   │       ├── schemas/          # Zod validation schemas
│   │       └── api-client/       # HTTP client for API calls
│   │
│   └── config/                    # Shared configurations
│       ├── eslint/               # Linting rules
│       ├── prettier/             # Code formatting
│       └── typescript/           # TypeScript configs
│
├── docker-compose.yml             # Local database setup
├── package.json                   # Root package.json
├── pnpm-workspace.yaml           # Monorepo workspace config
└── README.md                      # Project documentation
```

---

## Reading Order

Start with these files in this exact order to understand the codebase:

### Phase 1: Understand the Foundation (30 min)

| Order | File | Why Read This |
|-------|------|---------------|
| 1 | `pnpm-workspace.yaml` | See how the monorepo is structured |
| 2 | `package.json` (root) | See available scripts and how apps connect |
| 3 | `docker-compose.yml` | Understand what databases we use |

### Phase 2: Shared Code (45 min)

| Order | File | Why Read This |
|-------|------|---------------|
| 4 | `packages/shared/src/types/index.ts` | All data shapes used across the app |
| 5 | `packages/shared/src/schemas/index.ts` | How we validate data |
| 6 | `packages/shared/src/api-client/index.ts` | How frontend talks to backend |

### Phase 3: Database (30 min)

| Order | File | Why Read This |
|-------|------|---------------|
| 7 | `apps/api/prisma/schema.prisma` | Database table definitions |

### Phase 4: Backend API (1.5 hours)

| Order | File | Why Read This |
|-------|------|---------------|
| 8 | `apps/api/src/index.ts` | Server startup |
| 9 | `apps/api/src/app.ts` | Express setup & middleware order |
| 10 | `apps/api/src/config/env.ts` | Environment variables |
| 11 | `apps/api/src/lib/prisma.ts` | Database connection |
| 12 | `apps/api/src/lib/redis.ts` | Cache & rate limiting |
| 13 | `apps/api/src/middleware/validate.ts` | Input validation |
| 14 | `apps/api/src/middleware/admin.ts` | Authentication |
| 15 | `apps/api/src/routes/health.ts` | Simplest route (start here!) |
| 16 | `apps/api/src/routes/chat.ts` | More complex route |
| 17 | `apps/api/src/routes/payments.ts` | Stripe integration |
| 18 | `apps/api/src/websocket/index.ts` | Real-time communication |

### Phase 5: Frontend (1.5 hours)

| Order | File | Why Read This |
|-------|------|---------------|
| 19 | `apps/web/src/app/layout.tsx` | Root layout (wraps everything) |
| 20 | `apps/web/src/app/globals.css` | Global styles |
| 21 | `apps/web/src/app/page.tsx` | Homepage |
| 22 | `apps/web/src/components/layout/Header.tsx` | Navigation |
| 23 | `apps/web/src/lib/api.ts` | API client setup |
| 24 | `apps/web/src/lib/blog.ts` | MDX file reading |
| 25 | `apps/web/src/app/blog/page.tsx` | Blog list page |
| 26 | `apps/web/src/app/chat/page.tsx` | Chat with WebSocket |
| 27 | `apps/web/src/app/donate/page.tsx` | Payment flow |

---

## File Dependencies

This diagram shows which files import/use which other files:

```
                            ┌─────────────────────────────────────┐
                            │         ENTRY POINTS                │
                            │  (Where execution starts)           │
                            └─────────────────────────────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              ▼                            ▼                            ▼
       ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
       │ apps/web    │              │ apps/api    │              │apps/worker  │
       │ next dev    │              │ tsx watch   │              │ tsx watch   │
       └──────┬──────┘              └──────┬──────┘              └──────┬──────┘
              │                            │                            │
              ▼                            ▼                            ▼
       ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
       │ layout.tsx  │              │  index.ts   │              │  index.ts   │
       │ (root)      │              │  (entry)    │              │  (entry)    │
       └──────┬──────┘              └──────┬──────┘              └─────────────┘
              │                            │
              │ imports                    │ imports
              ▼                            ▼
       ┌─────────────┐              ┌─────────────┐
       │globals.css  │              │   app.ts    │
       │ Header.tsx  │              │  (express)  │
       │ Footer.tsx  │              └──────┬──────┘
       └──────┬──────┘                     │
              │                            │ uses
              │                            ▼
              │         ┌──────────────────────────────────────┐
              │         │              ROUTES                   │
              │         │  payments.ts  chat.ts  videos.ts     │
              │         │  donations.ts uploads.ts health.ts   │
              │         └───────────────────┬──────────────────┘
              │                             │
              │                             │ use
              │                             ▼
              │         ┌──────────────────────────────────────┐
              │         │           MIDDLEWARE                  │
              │         │  admin.ts  validate.ts  rateLimit.ts │
              │         └───────────────────┬──────────────────┘
              │                             │
              │                             │ use
              │                             ▼
              │         ┌──────────────────────────────────────┐
              │         │              LIB                      │
              │         │  prisma.ts  redis.ts  stripe.ts      │
              │         │  s3.ts  ai.ts  logger.ts             │
              │         └───────────────────┬──────────────────┘
              │                             │
              └──────────────┬──────────────┘
                             │
                             │ both import from
                             ▼
              ┌──────────────────────────────────────┐
              │         packages/shared              │
              │                                      │
              │  ┌────────────┐  ┌────────────────┐  │
              │  │  types/    │  │   schemas/     │  │
              │  │ index.ts   │  │   index.ts     │  │
              │  └─────┬──────┘  └───────┬────────┘  │
              │        │                 │           │
              │        └────────┬────────┘           │
              │                 ▼                    │
              │        ┌────────────────┐            │
              │        │  api-client/   │            │
              │        │   index.ts     │            │
              │        └────────────────┘            │
              └──────────────────────────────────────┘
```

### Key Dependency Chains:

**When a user visits /donate:**
```
Browser Request
    └── apps/web/src/app/donate/page.tsx
        └── imports: @/lib/api (API client)
            └── imports: @marins-room/shared (createApiClient)
                └── calls: POST /payments/checkout-session
                    └── apps/api/src/routes/payments.ts
                        ├── uses: middleware/validate.ts (check input)
                        ├── uses: lib/prisma.ts (save to DB)
                        └── uses: lib/stripe.ts (create session)
```

**When a user sends a chat message:**
```
Browser WebSocket
    └── apps/web/src/app/chat/page.tsx
        └── connects to: ws://localhost:4000/ws/chat
            └── apps/api/src/websocket/index.ts
                ├── uses: lib/prisma.ts (save message)
                ├── uses: lib/redis.ts (rate limiting)
                └── uses: lib/ai.ts (get AI response)
```

---

## Key Concepts Explained

### What is a Monorepo?
A single git repository containing multiple related projects. Benefits:
- Share code between projects (types, utilities)
- Consistent tooling (same linting rules everywhere)
- Atomic changes (update API and frontend together)

### What is pnpm?
A fast, disk-space efficient package manager (alternative to npm/yarn).
The `pnpm-workspace.yaml` file defines which folders are "packages".

### What is Prisma?
An ORM (Object-Relational Mapping) that lets you:
- Define database tables in a schema file
- Query the database using TypeScript (not raw SQL)
- Auto-generate TypeScript types for your data

### What is Zod?
A TypeScript-first validation library. It lets you:
- Define the "shape" of data (what fields, what types)
- Validate incoming data (from users, APIs)
- Automatically infer TypeScript types

### What is a WebSocket?
A persistent connection between browser and server that allows:
- Real-time, two-way communication
- Server can push data to client (no polling needed)
- Perfect for chat, live updates, notifications

### What is a Webhook?
When an external service (like Stripe) needs to notify your server:
- They send an HTTP POST to a URL you provide
- Your server processes the notification
- Example: Stripe tells us when a payment succeeds

### What is a Signed URL?
A temporary, pre-authorized URL that allows:
- Direct upload to cloud storage (S3)
- Bypasses your server (more efficient)
- Expires after a set time (security)

---

## Next Steps

After reading through the files in order:

1. **Run the project locally** - See the code in action
2. **Make a small change** - Edit the homepage text
3. **Add a new API route** - Create `/api/hello`
4. **Follow a request** - Use browser dev tools to trace a donation flow

Happy learning!
