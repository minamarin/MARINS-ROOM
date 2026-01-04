/**
 * ============================================================================
 * STRIPE CLIENT - Payment Processing Integration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * --------------------
 * This file creates and exports a configured Stripe client for processing
 * payments. Stripe handles all the complex payment stuff:
 *   - Credit card processing
 *   - Security (PCI compliance)
 *   - Fraud detection
 *   - Receipts
 *   - Refunds
 *
 * WHY USE STRIPE?
 * ---------------
 * Processing payments yourself is:
 *   - Legally complex (PCI compliance requirements)
 *   - Security nightmare (storing credit card data)
 *   - Expensive (building fraud detection)
 *
 * Stripe handles all of this for a small fee per transaction.
 * They're used by companies like Shopify, Lyft, and Slack.
 *
 * HOW OUR STRIPE INTEGRATION WORKS:
 * ----------------------------------
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │                      USER CLICKS DONATE                         │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  1. Frontend calls POST /payments/checkout-session              │
 *   │  2. Backend creates Stripe Checkout Session                     │
 *   │  3. Backend returns session URL                                 │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  4. Frontend redirects user to Stripe's checkout page          │
 *   │  5. User enters payment info on Stripe's secure page           │
 *   │  6. Stripe processes payment                                    │
 *   └─────────────────────────┬───────────────────────────────────────┘
 *                             │
 *                             ▼
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  7. Stripe sends webhook to our server                          │
 *   │  8. We update donation status to CONFIRMED                      │
 *   │  9. User sees success page                                      │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * STRIPE CHECKOUT vs STRIPE ELEMENTS:
 * ------------------------------------
 * We use Stripe Checkout (hosted by Stripe):
 *   - User goes to Stripe's secure page to pay
 *   - Stripe handles all the UI
 *   - Simplest integration
 *   - Best for one-time payments
 *
 * Alternative: Stripe Elements (embedded forms):
 *   - Payment form embedded in your site
 *   - More customization
 *   - More code to write
 *   - Better for subscriptions/complex flows
 *
 * RELATIONSHIP TO OTHER FILES:
 * ----------------------------
 * - config/env.ts: Provides STRIPE_SECRET_KEY
 * - routes/payments.ts: Uses stripe to create checkout sessions
 * - routes/webhooks/stripe.ts: Handles webhook events
 */

import Stripe from "stripe";

import { env } from "../config/env.js";

/**
 * Stripe client instance
 *
 * PSEUDOCODE:
 * -----------
 * Create a new Stripe client with:
 *
 *   STRIPE_SECRET_KEY (from env):
 *     - Your private API key (never expose this!)
 *     - Format: sk_test_... (test mode) or sk_live_... (production)
 *
 *   apiVersion: "2024-04-10":
 *     - Locks the API to a specific version
 *     - Prevents breaking changes from affecting your code
 *     - Update this periodically to get new features
 *
 *   typescript: true:
 *     - Enable TypeScript types
 *     - Better autocomplete and type checking
 *
 * IMPORTANT:
 *   - The secret key should NEVER be exposed to the frontend
 *   - It's only used on the server (backend)
 *   - The frontend uses the publishable key (pk_...)
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  typescript: true,
});
