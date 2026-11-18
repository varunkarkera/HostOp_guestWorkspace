export const factKeys = ["check_in", "wifi", "parking", "house_rules"] as const;
export type FactKey = (typeof factKeys)[number];
export type Facts = Partial<Record<FactKey, string>>;
export type Draft = {
  status: "draft" | "needs_human";
  text: string | null;
  confidence: "high" | "none";
  citations: { key: FactKey; value: string }[];
  reason: string | null;
};

const topics: Record<FactKey, RegExp> = {
  check_in: /\b(check[ -]?in|arrival time|arrive|arriving)\b/i,
  wifi: /\b(wi[ -]?fi|internet|network|password)\b/i,
  parking: /\b(park|parking|car|garage|vehicle)\b/i,
  house_rules: /\b(house rules|rules|pets?|smok(?:e|ing)|part(?:y|ies)|quiet hours)\b/i,
};
const sensitive = /\b(refund\w*|reimburse\w*|money back|damage\w*|broke\w*|broken|complain\w*|dirty|filthy|disgust\w*|unhappy|unsafe|injur\w*|emergency|fire|stolen|terrible|awful|not working|doesn.t work|cancel\w*|charge\w*|payment\w*)\b/i;
const injection = /\b(ignore|disregard|pretend|system prompt|instructions|override|guarantee|translate|instead|forget)\b/i;

export function draftReply(message: string, facts: Facts): Draft {
  const human = (reason: string): Draft => ({ status: "needs_human", text: null, confidence: "none", citations: [], reason });
  if (sensitive.test(message)) return human("Sensitive topic requires a manager.");
  if (injection.test(message)) return human("Instruction-like content requires review.");
  const matched = factKeys.filter((key) => topics[key].test(message));
  if (!matched.length) return human("No supported property fact answers this message.");
  const clauses = message.split(/(?:[?.!;]|\band\b|\balso\b|\bplus\b)/i).map((part) => part.trim()).filter(Boolean);
  const courtesy = /^(hi|hello|hey|thanks|thank you|please)[,!\s]*$/i;
  if (clauses.some((clause) => !courtesy.test(clause) && !factKeys.some((key) => topics[key].test(clause)))) {
    return human("Part of the request is outside the available facts.");
  }
  if (/\b(early|late|earlier|later|before|after|can (?:i|we)|could (?:i|we)|may (?:i|we)|is (?:it|there)|do you|how (?:far|much)|where.*key|checkout|check[ -]?out|pool|taxi|restaurant|luggage|breakfast|airport|cost|free|accessible|ev charg\w*|speed)\b/i.test(message)) {
    return human("A specific request needs a human to confirm.");
  }
  if (matched.some((key) => !facts[key]?.trim())) return human("A requested property fact is missing.");
  const allowedWords = new Set("hi hello hey thanks thank you please what when where how is are does do the a an i we our your my us me it there at in on for to of about tell give share send provide get find details detail information info policy access time starts start available availability name network password code connect wi fi wifi internet check checkin check-in arrival arriving arrive parking park car garage vehicle house rules rule pet pets smoking smoke parties party quiet hours and also plus with can could would like know again remind this that some be have".split(" "));
  const words = message.toLowerCase().replace(/what's/g, "what is").replace(/wi-fi/g, "wifi").replace(/check-in/g, "checkin").match(/[a-z0-9]+/g) ?? [];
  if (words.some((word) => !allowedWords.has(word))) return human("The request includes details not verified by the property facts.");
  const citations = matched.map((key) => ({ key, value: facts[key]! }));
  return {
    status: "draft", confidence: "high", citations, reason: null,
    text: `Hi! ${citations.map(({ value }) => value).join(" ")} Let us know if you need anything else.`,
  };
}