import type { Draft, Facts } from "./drafts";
export type Property = { id: string; company_id: string; name: string; location: string; image_url: string | null; facts: Facts };
export type Reservation = { id: string; company_id: string; property_id: string; guest_name: string; check_in: string; check_out: string; status: string; early_check_in_paid: boolean };
export type Message = { id: string; company_id: string; property_id: string; reservation_id: string; body: string; sent_at: string; draft?: Draft };
export type Contact = { reservation_id: string; email: string | null; phone: string | null };
export type Workspace = { company: string; role: "manager" | "cleaner"; demo: boolean; properties: Property[]; reservations: Reservation[]; messages: Message[]; contacts: Contact[] };
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`;
export function demoWorkspace(company = "juniper", role: "manager" | "cleaner" = "manager"): Workspace {
  const second = company === "shore";
  const companyId = second ? "shore" : "juniper";
  const date = new Date().toISOString().slice(0, 10);
  const next = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const properties: Property[] = [
    { id: `${companyId}-1`, company_id: companyId, name: second ? "The Tide House" : "Juniper House", location: second ? "Carmel, California" : "Joshua Tree, California", image_url: photo("photo-1600210492486-724fe5c67fb0"), facts: { check_in: "Check-in starts at 3:00 PM.", wifi: "Wi-Fi network: Juniper Guest. Password: stay-curious-24.", parking: "One parking space is available in the driveway.", house_rules: "No smoking or parties. Quiet hours are 10 PM to 8 AM. No pets." } },
    { id: `${companyId}-2`, company_id: companyId, name: second ? "Ocean Cottage" : "Casa Sol", location: second ? "Monterey, California" : "Palm Springs, California", image_url: photo("photo-1616486338812-3dadae4b4ace"), facts: { check_in: "Check-in starts at 4:00 PM.", wifi: "Wi-Fi network: Casa Sol. Password: sunny-days-26.", parking: "Two parking spaces are available in the garage.", house_rules: "No smoking. Quiet hours start at 9 PM. Pets are not permitted." } },
    { id: `${companyId}-3`, company_id: companyId, name: second ? "Seabird Studio" : "The Mesa Loft", location: second ? "Big Sur, California" : "Yucca Valley, California", image_url: photo("photo-1600607687920-4e2a09cf159d"), facts: { check_in: "Check-in starts at 3:00 PM.", wifi: "Wi-Fi network: Mesa Loft. Password: desert-light-26.", parking: "Use the marked space beside the entrance.", house_rules: "No pets, smoking, or parties. Quiet hours are 10 PM to 7 AM." } },
  ];
  const names = second ? ["Alex Chen", "Sofia Reyes", "Oliver Lee", "Mia Brooks", "Ethan Wilson", "Ava Davis"] : ["Emma Thompson", "James Miller", "Sophie Anderson", "Daniel Kim", "Olivia Garcia", "Lucas Martin"];
  const reservations = names.map((guest_name, index) => ({ id: `${companyId}-r${index}`, company_id: companyId, property_id: properties[index % 3].id, guest_name, check_in: date, check_out: next, status: "confirmed", early_check_in_paid: index === 3 }));
  const bodies = ["Hi! What is the Wi-Fi password?", "Would it be possible to check in early? We arrive around noon.", "What are the parking details?", "The apartment is dirty. I'd like to make a complaint.", "What time is check-in?", "What are the house rules and quiet hours?"];
  const messages = reservations.map((reservation, index) => ({ id: `${companyId}-m${index}`, company_id: companyId, property_id: reservation.property_id, reservation_id: reservation.id, body: bodies[index], sent_at: new Date(Date.now() - (index * 29 + 4) * 60000).toISOString() }));
  const contacts = role === "manager" ? reservations.map((reservation) => ({ reservation_id: reservation.id, email: `${reservation.guest_name.toLowerCase().replace(/ /g, ".")}@example.com`, phone: "+1 (555) 555-0100" })) : [];
  return { company: second ? "Shore & Stay" : "Juniper Stays", role, demo: true, properties, reservations, messages: role === "cleaner" ? [] : messages, contacts };
}