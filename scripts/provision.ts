import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_PASSWORD;
if (!url || !key || !password || password.length < 12) throw new Error("Set Supabase URL, service role key, and SEED_PASSWORD (12+ characters) in .env.local");
const db = createClient(url, key, { auth: { persistSession: false } });
for (const [company, suffix] of [["10000000-0000-0000-0000-000000000001", "juniper"], ["10000000-0000-0000-0000-000000000002", "shore"]]) {
  for (const role of ["manager", "cleaner"]) {
    const email = `${role}@${suffix}.example.com`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`${email}: ${error.message}. Provisioning expects fresh demo users.`);
    const { error: membershipError } = await db.from("memberships").insert({ user_id: data.user.id, company_id: company, role });
    if (membershipError) throw membershipError;
    console.log(`Created ${role}: ${email}`);
  }
}