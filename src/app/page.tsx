import { redirect } from "next/navigation";
import { isConfigured, userDb } from "@/lib/supabase";
import { demoWorkspace, type Workspace } from "@/lib/workspace";
import { Dashboard } from "@/components/dashboard";
import { reviewedDraft } from "@/lib/ai";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (!isConfigured()) return <Dashboard initial={demoWorkspace()} />;
  const db = await userDb();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await db.from("memberships").select("company_id,role").eq("user_id", user.id).single();
  if (!membership) return <main className="standalone"><h1>No workspace assigned</h1><p>Ask your manager to provision your membership.</p><form action="/api/auth/logout" method="post"><button>Sign out</button></form></main>;
  const [company, properties, reservations, messages, contacts] = await Promise.all([
    db.from("companies").select("name").eq("id", membership.company_id).single(),
    db.from("properties").select("*"),
    db.from("reservations").select("*").order("check_in"),
    db.from("messages").select("*").order("sent_at", { ascending: false }).limit(50),
    db.from("guest_contacts").select("reservation_id,email,phone"),
  ]);
  if (company.error || properties.error || reservations.error || messages.error || contacts.error) throw new Error("Workspace data unavailable");
  const workspace: Workspace = { company: company.data.name, role: membership.role, demo: false, properties: properties.data, reservations: reservations.data, messages: messages.data, contacts: contacts.data };
  workspace.messages = await Promise.all(workspace.messages.map(async (message) => ({ ...message,
    draft: await reviewedDraft(message.body, workspace.properties.find((property) => property.id === message.property_id)?.facts ?? {}),
  })));
  return <Dashboard initial={workspace} />;
}