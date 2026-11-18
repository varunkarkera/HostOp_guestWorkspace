import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const reservationId = process.argv[2];
if (!reservationId) throw new Error("Usage: npm run guest-link -- <reservation-uuid>");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const token = randomBytes(32).toString("hex");
const { data: existing, error: existingError } = await db.from("guest_links").select("checkout_session_id").eq("reservation_id", reservationId).maybeSingle();
if (existingError) throw existingError;
const { error } = await db.from("guest_links").upsert({ reservation_id: reservationId,
  token_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  checkout_session_id: existing?.checkout_session_id ?? null,
}, { onConflict: "reservation_id" });
if (error) throw error;
console.log(`${process.env.APP_URL || "http://127.0.0.1:3000"}/guest/${token}`);