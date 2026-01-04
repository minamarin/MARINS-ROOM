import express, { Router, type IRouter } from "express";
import type Stripe from "stripe";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { stripe } from "../../lib/stripe.js";

export const stripeWebhookRouter: IRouter = Router();

// Use raw body for Stripe webhook verification
stripeWebhookRouter.use(express.raw({ type: "application/json" }));

/**
 * Handle Stripe webhook events
 * POST /webhooks/stripe
 */
stripeWebhookRouter.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    logger.warn("Stripe webhook: Missing signature");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error(`Stripe webhook signature verification failed: ${message}`);
    return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, event);
        break;
      }
      case "checkout.session.expired": {
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session, event);
        break;
      }
      case "payment_intent.succeeded": {
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, event);
        break;
      }
      case "payment_intent.payment_failed": {
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, event);
        break;
      }
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("Failed to handle webhook event:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  event: Stripe.Event
) {
  const donationId = session.metadata?.donationId;

  if (!donationId) {
    logger.warn("Checkout completed but no donationId in metadata");
    return;
  }

  // Update donation status
  const donation = await prisma.donation.update({
    where: { id: donationId },
    data: {
      status: "CONFIRMED",
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    },
  });

  // Record payment event
  await prisma.paymentEvent.create({
    data: {
      donationId: donation.id,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as object,
    },
  });

  logger.info(`Donation ${donationId} confirmed`);
}

async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
  event: Stripe.Event
) {
  const donationId = session.metadata?.donationId;

  if (!donationId) {
    return;
  }

  await prisma.donation.update({
    where: { id: donationId },
    data: { status: "FAILED" },
  });

  await prisma.paymentEvent.create({
    data: {
      donationId,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as object,
    },
  });

  logger.info(`Donation ${donationId} expired`);
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  event: Stripe.Event
) {
  // Find donation by payment intent ID
  const donation = await prisma.donation.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (!donation) {
    logger.warn(`No donation found for payment intent ${paymentIntent.id}`);
    return;
  }

  await prisma.paymentEvent.create({
    data: {
      donationId: donation.id,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as object,
    },
  });

  logger.info(`Payment succeeded for donation ${donation.id}`);
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  event: Stripe.Event
) {
  const donation = await prisma.donation.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (!donation) {
    return;
  }

  await prisma.donation.update({
    where: { id: donation.id },
    data: { status: "FAILED" },
  });

  await prisma.paymentEvent.create({
    data: {
      donationId: donation.id,
      stripeEventId: event.id,
      eventType: event.type,
      payload: event as unknown as object,
    },
  });

  logger.info(`Payment failed for donation ${donation.id}`);
}
