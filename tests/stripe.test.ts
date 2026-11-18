import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
test("Stripe webhook signatures bind exact bytes and reject tampering", () => {
  const stripe = new Stripe("sk_test_not_a_real_key");
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_test", payment_status: "paid" } } });
  const secret = "whsec_test_only";
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, header, secret).id, "evt_test");
  assert.throws(() => stripe.webhooks.constructEvent(payload + " ", header, secret));
  assert.throws(() => stripe.webhooks.constructEvent(payload, header, "whsec_wrong"));
  const old = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 600 });
  assert.throws(() => stripe.webhooks.constructEvent(payload, old, secret));
});