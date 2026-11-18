import { userDb } from "@/lib/supabase";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response("Forbidden", { status: 403 });
  await (await userDb()).auth.signOut();
  return Response.redirect(new URL("/login", request.url), 303);
}