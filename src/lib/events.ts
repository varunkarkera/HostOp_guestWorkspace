import { z } from "zod";
const base = { id: z.string().min(1).max(200), version: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) };
const common = { id: z.string().min(1).max(200), property_id: z.string().min(1).max(200) };
export const pmsEvent = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("reservation.updated"), data: z.object({
    ...common, guest_name: z.string().min(1).max(150), check_in: z.iso.date(), check_out: z.iso.date(),
    status: z.enum(["confirmed", "cancelled"]), email: z.email().max(254).nullable(), phone: z.string().max(40).nullable(),
  }).refine((value) => value.check_out > value.check_in, "check_out must follow check_in") }),
  z.object({ ...base, type: z.literal("message.updated"), data: z.object({
    ...common, reservation_id: z.string().min(1).max(200), body: z.string().min(1).max(10000), sent_at: z.iso.datetime({ offset: true }),
  }) }),
]);