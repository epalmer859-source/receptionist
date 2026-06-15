/**
 * Proof for POST /api/chat — mobile-mechanic intake.
 *
 * Two parts:
 *   1) A GATED emergency test. A truck dies and won't restart; the customer
 *      reveals (over several turns) where the vehicle is and what it is, but
 *      NEVER says it's urgent. We assert the receptionist (a) asks for the
 *      vehicle's location and its year/make/model, and (b) captures the lead as
 *      `emergency` with make/model + a location populated.
 *
 *      The load-bearing assertion is on what the script did NOT say: urgency is
 *      INFERRED from "dead on the shoulder of I-575", never handed over. The
 *      script asserts none of its own customer lines contain an urgency word —
 *      so a pass means the model classified it, not that we fed it the answer.
 *
 *   2) UNHAPPY-PATH PROBES (print-only, never fail the run): a bare "hey", a
 *      customer who won't give a vehicle location, a pricing question, and a
 *      vague vehicle ("my car"). These exist to SHOW where the brain cracks.
 *
 * Usage:
 *   1. Set ANTHROPIC_API_KEY in your environment (or .env.local for the server).
 *   2. Start the app:        npm run dev
 *   3. In another terminal:  node scripts/test-chat.mjs
 *
 * Optional: BASE_URL (default http://localhost:3000).
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/chat`;
const MAX_TURNS = 8;

// Words that would mean we HANDED the model the urgency. The emergency test
// asserts none of its customer lines contain any of these — urgency must be
// inferred from the situation, not spoon-fed.
const URGENCY_WORDS =
  /\b(emergency|emergencies|urgent|urgently|asap|right away|immediately|911|life.?threatening)\b/i;

// Heuristics for "did the receptionist actually ASK for this?"
const ASKED_LOCATION =
  /\b(where|location|located)\b.*\b(vehicle|truck|car|it|you)\b|\bwhere('?s| is| are)\b/i;
const ASKED_VEHICLE = /\b(year|make|model|what kind of|what are you driving)\b/i;

const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Drive a conversation: feed `facts` one per turn (regardless of what the AI
 * asks — every needed fact is supplied across the turns), collecting every AI
 * reply, until a lead is captured or we run out of turns/facts.
 * Returns { lead, aiReplies[] }.
 */
async function converse(opener, facts, { maxTurns = MAX_TURNS, log = true } = {}) {
  const messages = [{ role: "user", content: opener }];
  const aiReplies = [];
  const pending = [...facts];
  if (log) console.log(`cust: ${opener}`);

  for (let turn = 0; turn < maxTurns; turn++) {
    const { reply, lead } = await send(messages);
    aiReplies.push(reply);
    if (log) console.log(`ai:   ${reply}`);
    messages.push({ role: "assistant", content: reply });

    if (lead) return { lead, aiReplies };

    if (pending.length === 0) return { lead: null, aiReplies };
    const next = pending.shift();
    if (log) console.log(`cust: ${next}`);
    messages.push({ role: "user", content: next });
  }
  return { lead: null, aiReplies };
}

// ---------------------------------------------------------------------------
// 1) GATED emergency test
// ---------------------------------------------------------------------------
async function emergencyTest() {
  console.log(C.cyan("\n=== EMERGENCY TEST (gated) ===\n"));

  // Opener: symptom + stranded framing, but NO explicit location, NO full
  // vehicle, and NO urgency word. The model must ask for the rest.
  const OPENER = "My truck just died and now it won't restart. I'm kinda stuck.";
  const FACTS = [
    // Location (implies emergency — highway shoulder — but never labeled urgent)
    "I'm pulled onto the shoulder of I-575 northbound, just past the Riverstone Parkway exit.",
    // Vehicle: year + make + model
    "It's a 2014 Chevrolet Silverado.",
    // Name
    "I'm Marcus Hale.",
    // Phone / callback
    "Best number is (770) 555-0142, you can call anytime.",
  ];

  // META-ASSERT: prove we never fed urgency. If this fails, the test is invalid.
  for (const line of [OPENER, ...FACTS]) {
    assert(
      !URGENCY_WORDS.test(line),
      `Test invalid: a customer line contains an urgency word ("${line}"). ` +
        `Urgency must be inferred, not spoon-fed.`
    );
  }

  const { lead, aiReplies } = await converse(OPENER, FACTS);
  const transcript = aiReplies.join("\n");

  // (a) The receptionist asked for the things it shouldn't assume.
  assert(
    ASKED_LOCATION.test(transcript),
    "Receptionist never asked where the vehicle is."
  );
  assert(
    ASKED_VEHICLE.test(transcript),
    "Receptionist never asked for the vehicle year/make/model."
  );

  // (b) A lead was captured, classified emergency (INFERRED), with vehicle +
  //     location populated.
  assert(lead, `No lead captured within ${MAX_TURNS} turns.`);
  console.log("\n--- Captured Lead ---");
  console.log(JSON.stringify(lead, null, 2));

  assert(
    lead.urgency === "emergency",
    `Expected INFERRED urgency "emergency", got "${lead.urgency}". ` +
      `(The customer never used an urgency word — the model had to classify it.)`
  );
  assert(
    lead.vehicleMake && lead.vehicleMake.trim().length > 0,
    "Lead captured without a vehicle make."
  );
  assert(
    lead.vehicleModel && lead.vehicleModel.trim().length > 0,
    "Lead captured without a vehicle model."
  );
  assert(
    lead.address && lead.address.trim().length > 0,
    "Lead captured without a vehicle location (address)."
  );
  assert(lead.status === "new", `Expected status "new", got "${lead.status}".`);
  assert(
    lead.channel === "web",
    `Expected channel "web", got "${lead.channel}".`
  );

  console.log(
    C.green(
      `\n✓ Emergency INFERRED (customer never said "urgent"); ` +
        `vehicle ${lead.vehicleYear ?? "?"} ${lead.vehicleMake} ${lead.vehicleModel} ` +
        `at "${lead.address}".`
    )
  );
}

// ---------------------------------------------------------------------------
// 2) UNHAPPY-PATH PROBES (print-only)
// ---------------------------------------------------------------------------
async function probe(label, opener, replies) {
  console.log(C.cyan(`\n--- PROBE: ${label} ---`));
  try {
    const { lead, aiReplies } = await converse(opener, replies, {
      maxTurns: 5,
    });
    if (lead) {
      console.log(C.dim("  → lead captured:"));
      console.log(
        C.dim(
          `    urgency=${lead.urgency} make=${lead.vehicleMake || "∅"} ` +
            `model=${lead.vehicleModel || "∅"} location="${lead.address || "∅"}"`
        )
      );
    } else {
      console.log(
        C.dim(
          `  → no lead after ${aiReplies.length} turn(s) (still gathering / deflected).`
        )
      );
    }
  } catch (err) {
    console.log(C.red(`  → probe errored: ${err.message}`));
  }
}

async function unhappyProbes() {
  console.log(C.cyan("\n=== UNHAPPY-PATH PROBES (print-only) ==="));

  // a) Bare opener — no information at all.
  await probe("bare 'hey'", "hey", [
    "just wondering if you guys can help",
  ]);

  // b) Customer who never gives a vehicle location.
  await probe(
    "no vehicle location",
    "My car won't start and I need someone to look at it.",
    [
      "It's a 2018 Honda Civic.",
      "I'm Priya.",
      "Honestly I'd rather not say exactly where it is.",
      "Like I said, I'd rather not give the location right now.",
    ]
  );

  // c) Pricing question.
  await probe("pricing question", "What'll it cost to fix my brakes?", [
    "It's a 2016 Toyota Camry, the brakes feel soft.",
  ]);

  // d) Vague vehicle ("my car"), never specified.
  await probe(
    "vague vehicle",
    "My car is making a grinding noise when I brake.",
    [
      "It's parked in my driveway at 88 Maple Court.",
      "I'm Sam.",
      "It's just my car, the usual one.",
      "I don't really know the year or model, it's my car.",
    ]
  );
}

async function main() {
  console.log(`Testing ${ENDPOINT}`);

  let emergencyOk = false;
  try {
    await emergencyTest();
    emergencyOk = true;
  } catch (err) {
    console.error(C.red(`\n✗ EMERGENCY TEST FAILED: ${err.message}`));
  }

  // Probes always run so you can see where it cracks, pass or fail.
  await unhappyProbes();

  console.log("");
  if (!emergencyOk) {
    console.error(C.red("✗ Gated emergency test did not pass (see above)."));
    process.exit(1);
  }
  console.log(C.green("✓ Gated emergency test passed."));
}

main().catch((err) => {
  console.error(C.red(`\n✗ ${err.message}`));
  process.exit(1);
});
