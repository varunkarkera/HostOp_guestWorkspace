import { draftReply } from "../src/lib/drafts";
import { cases, facts } from "../tests/fixtures";
let passed = 0;
for (const item of cases) {
  const result = draftReply(item.message, facts);
  const ok = item.expected === "human"
    ? result.status === "needs_human" && result.text === null && result.citations.length === 0
    : result.status === "draft" && JSON.stringify(result.citations.map((fact) => fact.key)) === JSON.stringify(item.expected)
      && result.citations.every((fact) => fact.value === facts[fact.key] && result.text?.includes(fact.value));
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${item.message}`);
}
console.log(`\n${passed}/${cases.length} passed (${(100 * passed / cases.length).toFixed(1)}%)`);
if (passed !== cases.length) process.exitCode = 1;