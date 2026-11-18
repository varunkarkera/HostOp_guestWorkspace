import { stripeClient } from "@/lib/stripe";
import { adminDb } from "@/lib/supabase";
import type Stripe from "stripe";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Signature required" }, { status: 400 });
  let event: Stripe.Event;
  try { event = stripeClient().webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return Response.json({ error: "Invalid signature" }, { status: 400 }); }
  if (event.livemode) return Response.json({ error: "Test mode only" }, { status: 400 });
  if (event.type !== "checkout.session.completed") return Response.json({ received: true });
  const session = event.data.object;
  if (session.payment_status !== "paid") return Response.json({ received: true });
  if (session.mode !== "payment" || session.amount_total !== 4000 || session.currency !== "usd"
    || session.metadata?.addon !== "early_check_in" || !session.metadata.reservation_id
    || session.client_reference_id !== session.metadata.reservation_id) {
    return Response.json({ error: "Unexpected purchase" }, { status: 400 });
  }
  const { error } = await adminDb().rpc("confirm_payment", {
    reservation_uuid: session.metadata.reservation_id, session_id: session.id,
    event_id: event.id, amount: session.amount_total, currency_code: session.currency,
  });
  if (error) return Response.json({ error: "Payment not recorded; retry" }, { status: 503 });
  return Response.json({ received: true });
}