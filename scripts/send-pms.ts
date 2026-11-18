import { createHmac } from "node:crypto";
const company = process.argv[2] || "10000000-0000-0000-0000-000000000001";
const secrets = JSON.parse(process.env.PMS_COMPANY_SECRETS || "{}") as Record<string, string>;
if (!secrets[company]) throw new Error("Set PMS_COMPANY_SECRETS in .env.local");
const today = new Date().toISOString().slice(0, 10);
const body = JSON.stringify({ id: process.argv[3] || "example-event-1", type: "reservation.updated", version: Number(process.argv[4] || 2), data: {
  id: "booking-001", property_id: "juniper-house", guest_name: "Emma Thompson", check_in: today,
  check_out: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), status: "confirmed", email: "emma@example.com", phone: "+15555550100",
} });
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", secrets[company]).update(`${timestamp}.${body}`).digest("hex");
const response = await fetch(`${process.env.APP_URL || "http://127.0.0.1:3000"}/api/webhooks/pms/${company}`, {
  method: "POST", headers: { "Content-Type": "application/json", "x-pms-timestamp": timestamp, "x-pms-signature": signature }, body,
});
console.log(response.status, await response.text());
if (!response.ok) process.exitCode = 1;