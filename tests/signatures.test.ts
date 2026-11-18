import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPmsSignature } from "../src/lib/signatures";
import { pmsEvent } from "../src/lib/events";
test("HMAC rejects tampering, malformed signatures and replay outside five minutes", () => {
  const timestamp = "1794873600";
  const body = '{"id":"one"}';
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const now = Number(timestamp) * 1000;
  assert.equal(verifyPmsSignature(body, timestamp, signature, secret, now), true);
  assert.equal(verifyPmsSignature(body + " ", timestamp, signature, secret, now), false);
  assert.equal(verifyPmsSignature(body, timestamp, signature, "other-company", now), false);
  assert.equal(verifyPmsSignature(body, timestamp, signature, secret, now + 301000), false);
  assert.equal(verifyPmsSignature(body, timestamp, "invalid", secret, now), false);
});
test("malformed PMS events are rejected", () => {
  assert.equal(pmsEvent.safeParse({ id: "x", type: "reservation.updated", version: -1, data: {} }).success, false);
});