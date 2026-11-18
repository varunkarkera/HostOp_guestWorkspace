import { adminDb } from "@/lib/supabase";
import { verifyPmsSignature } from "@/lib/signatures";
import { pmsEvent } from "@/lib/events";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ company: string }> }) {
  const { company } = await context.params;
  if (!z.uuid().safeParse(company).success) return Response.json({ error: "Invalid company" }, { status: 400 });
  const secrets = JSON.parse(process.env.PMS_COMPANY_SECRETS || "{}") as Record<string, string>;
  const secret = secrets[company];
  if (!secret) return Response.json({ error: "Unknown integration" }, { status: 401 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 64000) return Response.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyPmsSignature(body, request.headers.get("x-pms-timestamp"), request.headers.get("x-pms-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let json: unknown;
  try { json = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = pmsEvent.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid event", details: parsed.error.issues }, { status: 400 });
  const { data, error } = await adminDb().rpc("ingest_pms", { target_company: company, event: parsed.data });
  if (error) return Response.json({ error: "Dependency unavailable; retry this event" }, { status: error.code === "P0002" ? 409 : 503 });
  return Response.json({ result: data });
}