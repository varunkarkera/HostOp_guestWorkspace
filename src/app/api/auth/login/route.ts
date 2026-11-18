import { userDb } from "@/lib/supabase";
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const email = String(form.get("email") || "").slice(0, 254);
  const password = String(form.get("password") || "").slice(0, 128);
  const { error } = await (await userDb()).auth.signInWithPassword({ email, password });
  return Response.redirect(new URL(error ? "/login?error=1" : "/", request.url), 303);
}