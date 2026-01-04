import { CreateCheckoutSessionSchema } from "@marins-room/shared";
import { Router } from "express";

import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";

export const paymentsRouter = Router();

// Rate limit: 10 checkout sessions per IP per hour
paymentsRouter.use(
  rateLimit({
    limit: 10,
    windowSeconds: 3600,
    keyPrefix: "payments",
  })
);

/**
 * Create a Stripe Checkout session for a donation
 * POST /payments/checkout-session
 */
paymentsRouter.post(
  "/checkout-session",
  validateBody(CreateCheckoutSessionSchema),
  async (req, res) => {
    try {
      const { amount, currency, name, email, message } = req.body;

      // Create donation record in pending state
      const donation = await prisma.donation.create({
        data: {
          amount,
          currency,
          name,
          email,
          message,
          status: "PENDING",
        },
      });

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: "Donation to Marin's Room",
                description: message || "Thank you for your support!",
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        customer_email: email,
        metadata: {
          donationId: donation.id,
          donorName: name || "",
          message: message || "",
        },
        success_url: `${env.WEB_ORIGIN}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.WEB_ORIGIN}/donate?canceled=true`,
      });

      // Update donation with Stripe session ID
      await prisma.donation.update({
        where: { id: donation.id },
        data: { stripeSessionId: session.id },
      });

      logger.info(`Checkout session created: ${session.id} for donation ${donation.id}`);

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url,
        },
      });
    } catch (error) {
      logger.error("Failed to create checkout session:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "CHECKOUT_FAILED",
          message: "Failed to create checkout session",
        },
      });
    }
  }
);
