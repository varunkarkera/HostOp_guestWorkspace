import "server-only";
import Stripe from "stripe";
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Only Stripe test-mode keys are accepted");
  return new Stripe(key, { maxNetworkRetries: 2 });
}