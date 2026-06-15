/**
 * Proof for POST /api/chat — the first concrete task.
 *
 * Drives a hardcoded emergency conversation against the running endpoint and
 * confirms the receptionist gathers what it needs and then captures the lead
 * as `emergency`.
 *
 * Usage:
 *   1. Set ANTHROPIC_API_KEY in your environment (or .env.local).
 *   2. Start the app:        npm run dev
 *   3. In another terminal:  node scripts/test-chat.mjs
 *
 * Optional: BASE_URL (default http://localhost:3000).
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/chat`;
const MAX_TURNS = 8;

// The opener — "upstairs AC quit, 84° inside with an infant" — plus the facts
// the customer reveals as the receptionist asks for them.
const OPENER = "My upstairs AC just quit and it's 84° inside with an infant.";
const CUSTOMER_FACTS = [
  "I'm Dana Reed.",
  "142 Oak Ridge Drive, Woodstock GA 30188.",
  "My cell is (770) 555-0188, anytime today works.",
];

async function send(messages) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, channel: "web" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(
      `POST /api/chat failed (${res.status}): ${data.error ?? "unknown error"}`
    );
  }
  return data;
}

function pass(msg) {
  console.log(`\n\x1b[32m✓ ${msg}\x1b[0m`);
}
function fail(msg) {
  console.error(`\n\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

async function main() {
  console.log(`Testing ${ENDPOINT}\n`);

  const messages = [{ role: "user", content: OPENER }];
  console.log(`cust: ${OPENER}`);

  const facts = [...CUSTOMER_FACTS];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { reply, lead } = await send(messages);
    console.log(`ai:   ${reply}`);
    messages.push({ role: "assistant", content: reply });

    if (lead) {
      console.log("\n--- Captured Lead ---");
      console.log(JSON.stringify(lead, null, 2));

      if (lead.urgency !== "emergency") {
        fail(`Expected urgency "emergency", got "${lead.urgency}".`);
      }
      if (!lead.address || !lead.address.trim()) {
        fail("Lead captured without a service address.");
      }
      if (lead.status !== "new") {
        fail(`Expected status "new", got "${lead.status}".`);
      }
      if (lead.channel !== "web") {
        fail(`Expected channel "web", got "${lead.channel}".`);
      }
      pass(
        `Lead captured as emergency with address "${lead.address}" — the dashboard "just works".`
      );
      return;
    }

    if (facts.length === 0) {
      fail("Ran out of customer facts before the receptionist captured a lead.");
    }
    const next = facts.shift();
    console.log(`cust: ${next}`);
    messages.push({ role: "user", content: next });
  }

  fail(`No lead captured within ${MAX_TURNS} turns.`);
}

main().catch((err) => fail(err.message));
