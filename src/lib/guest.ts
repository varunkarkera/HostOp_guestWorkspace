import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "./supabase";
export async function guestReservation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = adminDb();
  const { data: link, error } = await db.from("guest_links").select("reservation_id,expires_at,checkout_session_id")
    .eq("token_hash", createHash("sha256").update(token).digest("hex")).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Guest link lookup unavailable");
  if (!link) return null;
  const { data: reservation, error: reservationError } = await db.from("reservations").select("id,property_id,check_in,check_out,status,early_check_in_paid")
    .eq("id", link.reservation_id).single();
  if (reservationError) throw new Error("Reservation lookup unavailable");
  if (reservation.status !== "confirmed") return null;
  const { data: property } = await db.from("properties").select("name,location,image_url").eq("id", reservation.property_id).single();
  return { link, reservation, property };
}