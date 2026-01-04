# 🌸✨ Deployment Guide ✨🌸

---

> *"Ship your room to the world."* 🚀💖

---

This document explains how to deploy **Marin's Room** to production safely.

**Don't worry if you've never deployed before!** We'll walk through every step together. 🌷

---

## 📋 Prerequisites (Do This First!)

Before deploying, make sure you have:

| 🌸 | Requirement | How to Get It |
|---|-------------|---------------|
| ✅ | **Node.js 18+** | [Download here](https://nodejs.org/) |
| ✅ | **pnpm** | Run `npm install -g pnpm` in terminal |
| ✅ | **Git** | [Download here](https://git-scm.com/) |
| ✅ | **GitHub account** | [Sign up free](https://github.com/) |
| ✅ | **Your code pushed to GitHub** | We'll need this for deployment |

---

## 🌍 Recommended Production Stack

Here's what each service does and why we need it:

| 🌸 | Service | What It Does | Recommended Provider |
|---|---------|--------------|---------------------|
| 🎀 | **Frontend** | Hosts your website (what users see) | [Vercel](https://vercel.com) (free tier!) |
| 🛠️ | **API** | Runs your backend server code | [Railway](https://railway.app) ($5/mo) |
| 🐘 | **Database** | Stores your data (users, posts, etc.) | [Neon](https://neon.tech) (free tier!) |
| ⚡ | **Redis** | Fast temporary storage (sessions, cache) | [Upstash](https://upstash.com) (free tier!) |
| ☁️ | **Storage** | Stores uploaded files (images, videos) | [Cloudflare R2](https://cloudflare.com) (free tier!) |
| 💳 | **Payments** | Handles donations via credit card | [Stripe](https://stripe.com) |

💡 **Tip:** Most of these have free tiers! You can deploy for ~$5/month or less.

---

## 🧱 Deployment Order (Important!)

**Why does order matter?** Each step depends on the previous one!

```
   1️⃣ ──→ 2️⃣ ──→ 3️⃣ ──→ 4️⃣ ──→ 5️⃣
Database  Redis  Storage  API   Frontend
   💖      💖      💖      💖      💖
```

---

## 1️⃣ Set Up Your Database (Neon)

**What is a database?** It's where all your app's data lives - users, blog posts, comments, etc.

### Step-by-Step:

1. **Create an account** at [neon.tech](https://neon.tech)

2. **Click "Create Project"**
   - Name it something like `marins-room-prod`
   - Choose the region closest to your users

3. **Find your connection string**
   - After creating, you'll see a "Connection string"
   - It looks like this:
   ```
   postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

4. **Save this!** You'll need it as `DATABASE_URL` later.

✅ **Done?** You should have a connection string that starts with `postgresql://`

---

## 2️⃣ Set Up Redis (Upstash)

**What is Redis?** It's super-fast temporary storage. We use it for real-time chat and caching.

### Step-by-Step:

1. **Create an account** at [upstash.com](https://upstash.com)

2. **Click "Create Database"**
   - Name: `marins-room-redis`
   - Type: **Regional**
   - Region: Same region as your database!

3. **Find your connection string**
   - Go to your database → "REST API" section
   - Copy the `UPSTASH_REDIS_REST_URL`
   - It looks like this:
   ```
   https://us1-merry-cat-12345.upstash.io
   ```

4. **Also copy the token** (`UPSTASH_REDIS_REST_TOKEN`)

✅ **Done?** You should have a Redis URL and token.

---

## 3️⃣ Set Up File Storage (Cloudflare R2)

**What is R2?** It's where uploaded images and videos are stored.

### Step-by-Step:

1. **Create an account** at [cloudflare.com](https://cloudflare.com)

2. **Go to R2** in the sidebar

3. **Create a bucket**
   - Click "Create bucket"
   - Name: `marins-room-uploads`
   - Location: Choose "Automatic"

4. **Set up public access** (so users can view uploads)
   - Go to bucket → Settings → Public Access
   - Enable "Allow public access"
   - Note your public URL: `https://pub-xxx.r2.dev`

5. **Create API credentials**
   - Go to R2 → "Manage R2 API Tokens"
   - Click "Create API Token"
   - Permissions: "Object Read & Write"
   - Copy these values:
   ```
   Access Key ID:     your-access-key-here
   Secret Access Key: your-secret-key-here
   Endpoint:          https://your-account-id.r2.cloudflarestorage.com
   ```

6. **Set up CORS** (allows your website to upload files)
   - Go to bucket → Settings → CORS Policy
   - Add this policy:
   ```json
   [
     {
       "AllowedOrigins": ["https://your-frontend-domain.com"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   💡 **Note:** Replace `your-frontend-domain.com` with your actual domain later!

✅ **Done?** You should have: bucket name, access key, secret key, and endpoint URL.

---

## 4️⃣ Set Up Stripe (Payments)

**What is Stripe?** It processes credit card payments for donations.

### Step-by-Step:

1. **Create an account** at [stripe.com](https://stripe.com)

2. **Complete your business profile**
   - Stripe requires some info before you can accept real payments
   - You can skip this for testing (use "Test mode")

3. **Get your API keys**
   - Go to Developers → API Keys
   - You'll see two keys:
   ```
   Publishable key: pk_test_xxxxx  (safe to expose, used in frontend)
   Secret key:      sk_test_xxxxx  (NEVER expose this! Backend only)
   ```

4. **Set up webhooks** (Stripe tells your app when payments happen)
   - Go to Developers → Webhooks
   - Click "Add endpoint"
   - URL: `https://your-api-domain.com/webhooks/stripe`
     (You'll get this URL after deploying the API)
   - Select events to listen to:
     - ✅ `checkout.session.completed`
     - ✅ `payment_intent.succeeded`
     - ✅ `payment_intent.payment_failed`
   - Click "Add endpoint"
   - **Copy the "Signing secret"** (starts with `whsec_`)

💡 **Test vs Live Mode:**
- Use "Test mode" first (toggle in top-right)
- Test card number: `4242 4242 4242 4242` (any future date, any CVC)
- Switch to "Live mode" when ready for real payments

✅ **Done?** You should have: publishable key, secret key, and webhook signing secret.

---

## 5️⃣ Deploy the API (Railway)

**What is Railway?** It runs your backend server code 24/7.

### Step-by-Step:

1. **Create an account** at [railway.app](https://railway.app)
   - Sign up with GitHub (easiest!)

2. **Create a new project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `marins-room` repository
   - Choose the `apps/api` directory

3. **Add environment variables**
   - Go to your service → "Variables" tab
   - Click "New Variable" for each one:

   ```bash
   # 🌸 Database (from Step 1)
   DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/neondb?sslmode=require

   # 🌸 Redis (from Step 2)
   REDIS_URL=https://us1-xxx.upstash.io
   REDIS_TOKEN=your-upstash-token

   # 🌸 Storage (from Step 3)
   S3_BUCKET=marins-room-uploads
   S3_REGION=auto
   S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key

   # 🌸 Stripe (from Step 4)
   STRIPE_SECRET_KEY=sk_test_xxxxx
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx

   # 🌸 Security
   JWT_SECRET=generate-a-random-32-character-string-here
   NODE_ENV=production
   ```

   💡 **How to generate JWT_SECRET:** Run this in your terminal:
   ```bash
   openssl rand -base64 32
   ```

4. **Run database migrations**
   - Go to your service → "Settings" → "Deploy"
   - Set the start command to:
   ```bash
   pnpm prisma migrate deploy && pnpm start
   ```

5. **Get your API URL**
   - Railway gives you a URL like: `https://marins-room-api.up.railway.app`
   - Go to Settings → Networking → "Generate Domain"

6. **Test it's working**
   - Visit `https://your-api-url.railway.app/health`
   - You should see: `{"status": "ok"}`

7. **Update Stripe webhook URL**
   - Go back to Stripe → Webhooks
   - Update the endpoint URL to your real Railway URL

✅ **Done?** Your API should be running! Test the health endpoint.

---

## 6️⃣ Deploy the Frontend (Vercel)

**What is Vercel?** It hosts your website and makes it super fast.

### Step-by-Step:

1. **Create an account** at [vercel.com](https://vercel.com)
   - Sign up with GitHub (easiest!)

2. **Import your project**
   - Click "Add New" → "Project"
   - Select your GitHub repository
   - **Important:** Set the "Root Directory" to `apps/web`

3. **Configure the project**
   - Framework Preset: **Next.js** (should auto-detect)
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`

4. **Add environment variables**
   - Before deploying, add these variables:

   ```bash
   # 🌸 Your API URL (from Step 5)
   NEXT_PUBLIC_API_URL=https://your-api.up.railway.app

   # 🌸 Stripe publishable key (safe for frontend!)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
   ```

   ⚠️ **Important:** Variables starting with `NEXT_PUBLIC_` are exposed to browsers. Only put safe, non-secret values here!

5. **Deploy!**
   - Click "Deploy"
   - Wait 2-3 minutes for the build
   - You'll get a URL like: `https://marins-room.vercel.app`

6. **Set up your custom domain** (optional)
   - Go to Settings → Domains
   - Add your domain (e.g., `marinsroom.com`)
   - Follow Vercel's instructions to update your DNS

7. **Update CORS settings**
   - Remember the R2 CORS policy from Step 3?
   - Go back and update `AllowedOrigins` with your Vercel URL

✅ **Done?** Visit your Vercel URL - your site should be live!

---

## 🔐 Environment Variables Cheatsheet

Here's everything in one place:

### 🌷 API Variables (`apps/api`)

| Variable | Example Value | Where to Get It |
|----------|---------------|-----------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | Neon dashboard |
| `REDIS_URL` | `https://us1-xxx.upstash.io` | Upstash dashboard |
| `REDIS_TOKEN` | `AXxxxx...` | Upstash dashboard |
| `STRIPE_SECRET_KEY` | `sk_test_xxxxx` | Stripe → API Keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxx` | Stripe → Webhooks |
| `S3_BUCKET` | `marins-room-uploads` | You chose this! |
| `S3_REGION` | `auto` | Use `auto` for R2 |
| `S3_ENDPOINT` | `https://xxx.r2.cloudflarestorage.com` | R2 dashboard |
| `S3_ACCESS_KEY` | `xxxxx` | R2 API tokens |
| `S3_SECRET_KEY` | `xxxxx` | R2 API tokens |
| `JWT_SECRET` | `random-32-char-string` | Generate yourself |
| `NODE_ENV` | `production` | Always `production` |

### 🌷 Frontend Variables (`apps/web`)

| Variable | Example Value | Where to Get It |
|----------|---------------|-----------------|
| `NEXT_PUBLIC_API_URL` | `https://api.marinsroom.com` | Your Railway URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_xxxxx` | Stripe → API Keys |

---

## 🩺 Health Checks

After deploying, test these URLs:

```bash
# 🌸 Check API is running
curl https://your-api.railway.app/health
# Expected: {"status": "ok"}

# 🌸 Check database connection
curl https://your-api.railway.app/health/db
# Expected: {"status": "ok", "database": "connected"}

# 🌸 Check Redis connection
curl https://your-api.railway.app/health/redis
# Expected: {"status": "ok", "redis": "connected"}
```

💡 **What is `curl`?** It's a command to fetch URLs from your terminal. You can also just visit these URLs in your browser!

---

## 🚨 Troubleshooting

### "API won't start"

```
🔍 Check Railway logs (Deployments → View Logs)
🔍 Common issues:
   - DATABASE_URL is wrong or missing
   - Missing environment variables
   - Migrations haven't run

💖 Fix: Double-check all environment variables are set correctly
```

### "Database connection failed"

```
🔍 Check your DATABASE_URL format:
   postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

🔍 Common issues:
   - Password has special characters (need URL encoding)
   - Forgot ?sslmode=require at the end
   - Database is paused (Neon pauses after inactivity)

💖 Fix: Go to Neon dashboard and check connection string
```

### "Stripe webhooks not working"

```
🔍 Check Stripe dashboard → Webhooks → Recent events
🔍 Common issues:
   - Wrong endpoint URL
   - Wrong webhook secret
   - API not running when Stripe sends event

💖 Fix:
   1. Verify URL is exactly: https://your-api/webhooks/stripe
   2. Re-copy the webhook signing secret
   3. Test with Stripe CLI: stripe trigger payment_intent.succeeded
```

### "File uploads failing"

```
🔍 Check browser console for CORS errors
🔍 Common issues:
   - CORS not configured for your domain
   - Wrong S3 credentials
   - Bucket doesn't exist

💖 Fix: Update R2 CORS policy with your exact frontend URL
```

### "Frontend can't reach API"

```
🔍 Open browser DevTools → Network tab
🔍 Common issues:
   - NEXT_PUBLIC_API_URL is wrong
   - API is down
   - CORS blocking requests

💖 Fix:
   1. Check the API URL is correct (no trailing slash!)
   2. Make sure API is running (check /health)
   3. Add your Vercel URL to API's CORS allowed origins
```

### "Build failed on Vercel"

```
🔍 Check Vercel build logs
🔍 Common issues:
   - TypeScript errors
   - Missing dependencies
   - Wrong root directory

💖 Fix:
   1. Run `pnpm build` locally first to catch errors
   2. Make sure root directory is set to `apps/web`
```

---

## 🔄 Updating Your Deployment

After you push changes to GitHub:

| Platform | What Happens |
|----------|--------------|
| **Vercel** | Auto-deploys on every push to `main` 🎉 |
| **Railway** | Auto-deploys on every push to `main` 🎉 |

💡 **Tip:** Create a `staging` branch for testing before pushing to `main`!

---

## 🎯 Post-Deployment Checklist

Run through this after deploying:

- [ ] 🌸 Can you visit the frontend URL?
- [ ] 🌸 Does the homepage load without errors?
- [ ] 🌸 Can you sign up / log in?
- [ ] 🌸 Can you create a blog post?
- [ ] 🌸 Can you upload an image?
- [ ] 🌸 Can you make a test donation? (use test card `4242 4242 4242 4242`)
- [ ] 🌸 Does real-time chat work?
- [ ] 🌸 Do you receive the Stripe webhook? (check Stripe dashboard)

---

## ✨ You Did It!

```
    🎀
   🎀🎀🎀
  🎀🎀🎀🎀🎀
 🎀🎀🎀🎀🎀🎀🎀
🎀🎀🎀🎀🎀🎀🎀🎀🎀
    |||
    |||
```

**Congratulations!** Your room is now live on the internet! 🌸💖

You just:
- Set up a production database
- Configured Redis caching
- Set up file storage
- Integrated payment processing
- Deployed a backend API
- Deployed a frontend website

That's real full-stack deployment! Be proud of yourself! 🌷✨

---

## 🆘 Need Help?

- 📖 Check the [README](./README.md) for local development
- 🐛 Found a bug? [Open an issue](https://github.com/your-username/marins-room/issues)
- 💬 Questions? Start a [Discussion](https://github.com/your-username/marins-room/discussions)

---

<p align="center">
  <img src="https://img.shields.io/badge/status-deployed-ff69b4?style=for-the-badge" alt="Deployed"/>
  <img src="https://img.shields.io/badge/you-did%20it!-pink?style=for-the-badge" alt="You did it!"/>
  <img src="https://img.shields.io/badge/vibes-immaculate-ff69b4?style=for-the-badge" alt="Immaculate vibes"/>
</p>
