import { guestReservation } from "@/lib/guest";
import { stripeClient } from "@/lib/stripe";
import { adminDb } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = process.env.APP_URL;
  if (!origin || request.headers.get("origin") !== new URL(origin).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const guest = await guestReservation(token);
  if (!guest) return Response.json({ error: "Link expired or unavailable" }, { status: 404 });
  if (guest.reservation.early_check_in_paid) return Response.redirect(`${origin}/guest/${token}`, 303);
  const stripe = stripeClient();
  if (guest.link.checkout_session_id) {
    const previous = await stripe.checkout.sessions.retrieve(guest.link.checkout_session_id);
    if (previous.status === "open" && previous.url) return Response.redirect(previous.url, 303);
    return Response.redirect(`${origin}/guest/${token}?status=pending`, 303);
  }
  const { data: attemptedAt, error: attemptError } = await adminDb().rpc("claim_checkout", { reservation_uuid: guest.reservation.id });
  if (attemptError || !attemptedAt) return Response.json({ error: "Checkout unavailable" }, { status: 503 });
  if (Date.now() - new Date(attemptedAt).getTime() > 23 * 60 * 60 * 1000) {
    return Response.json({ error: "An earlier checkout needs host review. No new payment was created." }, { status: 409 });
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment", client_reference_id: guest.reservation.id,
    metadata: { reservation_id: guest.reservation.id, addon: "early_check_in" },
    line_items: [{ price_data: { currency: "usd", unit_amount: 4000, product_data: { name: "Early check-in" } }, quantity: 1 }],
    payment_method_types: ["card"],
    success_url: `${origin}/guest/${token}?status=pending`, cancel_url: `${origin}/guest/${token}`,
  }, { idempotencyKey: `early-check-in:${guest.reservation.id}:v1` });
  const { error } = await adminDb().from("guest_links").update({ checkout_session_id: session.id })
    .eq("reservation_id", guest.reservation.id).is("checkout_session_id", null);
  if (error || !session.url) return Response.json({ error: "Checkout unavailable; please retry" }, { status: 503 });
  return Response.redirect(session.url, 303);
}