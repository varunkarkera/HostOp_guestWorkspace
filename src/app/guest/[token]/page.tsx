import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Layers, ShieldCheck } from "lucide-react";
import { guestReservation } from "@/lib/guest";
export const dynamic = "force-dynamic";
export default async function GuestPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ status?: string }> }) {
  const { token } = await params;
  const { status } = await searchParams;
  const guest = await guestReservation(token);
  if (!guest) notFound();
  return <main className="guest-page"><Link className="brand" href="/"><span className="brand-icon"><Layers size={23} /></span>hostop.</Link>{guest.property?.image_url && <Image unoptimized className="guest-photo" src={guest.property.image_url} width={1000} height={600} alt={guest.property.name} />}<h1>A little more time to settle in.</h1><p>{guest.property?.name} / {guest.property?.location}</p><p>{guest.reservation.check_in} to {guest.reservation.check_out}</p><section className="addon"><div><h2>Early check-in</h2><p>A one-time add-on for your reservation.</p></div><strong className="addon-price">$40<span className="muted">.00</span></strong></section>{guest.reservation.early_check_in_paid ? <div className="guest-status"><CheckCircle2 size={20} /><strong> Early check-in confirmed</strong><p>Your payment has been received.</p></div> : status === "pending" ? <div className="guest-status">Your payment is being confirmed. Refresh this page in a moment. No add-on is confirmed until payment verification is complete.</div> : <form action="/api/checkout" method="post"><input type="hidden" name="token" value={token} /><button className="primary-button"><ShieldCheck size={16} />Continue to secure checkout</button></form>}<p style={{ marginTop: 22, fontSize: 11 }}>Stripe test mode. No real payment will be taken.</p></main>;
}