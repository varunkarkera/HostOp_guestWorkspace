import { test } from "node:test";
import assert from "node:assert/strict";
import { draftReply } from "../src/lib/drafts";
import { cases, facts } from "./fixtures";
for (const item of cases) {
  test(item.message, () => {
    const result = draftReply(item.message, facts);
    assert.equal(result.status, item.expected === "human" ? "needs_human" : "draft");
    assert.deepEqual(result.citations.map((fact) => fact.key), item.expected === "human" ? [] : item.expected);
    for (const citation of result.citations) {
      assert.equal(citation.value, facts[citation.key]);
      assert.ok(result.text?.includes(citation.value));
    }
    if (item.expected === "human") assert.equal(result.text, null);
  });
}
test("missing facts cannot be invented", () => assert.equal(draftReply("Wi-Fi password?", {}).status, "needs_human"));
test("facts never cross properties", () => assert.ok(!draftReply("Wi-Fi password?", { wifi: "Network: Other property." }).text?.includes("Juniper")));