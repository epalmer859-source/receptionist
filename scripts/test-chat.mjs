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

// Heuristic for "did the receptionist actually ASK for the contact info we
// withheld?" (name / phone). We assert on this because the opener gives the
// vehicle + location, so the only thing the brain must gather is the contact —
// and we never volunteer it.
const ASKED_CONTACT =
  /\b(your name|name\??|number|phone|reach you|call you|best way to reach|get a hold)\b/i;

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

  // Opener carries the situation (location + vehicle + symptom) like the spec
  // example — but NEVER an urgency word. Name and phone are withheld so we can
  // assert the brain ASKS for them (a thing we did not spoon-feed). The
  // load-bearing assertion is that urgency is INFERRED as emergency from "dead
  // on the shoulder of I-575", which the customer never labels as urgent.
  const OPENER =
    "My truck died on the shoulder of I-575 northbound, just past the Riverstone Parkway exit, and it won't restart — it's a 2014 Chevy Silverado.";
  const FACTS = [
    "I'm Marcus Hale.",
    "Best number is (770) 555-0142, you can call anytime.",
    "No warning lights — it just died suddenly while I was driving and won't crank now.",
    "I'm just standing by the truck waiting to hear back.",
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

  // (a) The receptionist asked for the contact info we withheld (not assumed it).
  assert(
    ASKED_CONTACT.test(transcript),
    "Receptionist never asked for the customer's name/phone."
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
  assert(
    lead.needsReview === false,
    `Expected needsReview false for a complete lead, got "${lead.needsReview}".`
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
// 2) UNHAPPY-PATH PROBES
//    Part B should keep these from DROPPING the customer: the two "stubborn"
//    cases (no location, unknown vehicle) should now CAPTURE a partial lead
//    with needsReview=true rather than looping forever. Verdicts print; they
//    don't gate the run (model behavior varies turn to turn).
// ---------------------------------------------------------------------------
async function probe(label, opener, replies, { maxTurns = 6 } = {}) {
  console.log(C.cyan(`\n--- PROBE: ${label} ---`));
  try {
    const { lead, aiReplies } = await converse(opener, replies, { maxTurns });
    if (lead) {
      console.log(C.dim("  → lead captured:"));
      console.log(
        C.dim(
          `    urgency=${lead.urgency} needsReview=${lead.needsReview} ` +
            `make=${lead.vehicleMake || "∅"} model=${lead.vehicleModel || "∅"} ` +
            `location="${lead.address || "∅"}"`
        )
      );
    } else {
      console.log(
        C.dim(`  → no lead after ${aiReplies.length} turn(s) (still gathering).`)
      );
    }
    return { lead, aiReplies };
  } catch (err) {
    console.log(C.red(`  → probe errored: ${err.message}`));
    return { lead: null, aiReplies: [] };
  }
}

function verdict(ok, msg) {
  console.log(ok ? C.green(`  ✓ ${msg}`) : C.red(`  ✗ ${msg}`));
}

async function unhappyProbes() {
  console.log(C.cyan("\n=== UNHAPPY-PATH PROBES ==="));

  // a) Bare opener — no information. Expect: still gathering, no capture.
  {
    const { lead } = await probe("bare 'hey'", "hey", [
      "just wondering if you guys can help",
    ]);
    verdict(!lead, "bare opener keeps gathering (no premature capture)");
  }

  // b) Customer who never gives a vehicle location. Part B escape hatch:
  //    after ~2 honest tries, capture partial with needsReview=true.
  {
    const { lead } = await probe(
      "no vehicle location (escape hatch)",
      "My car won't start and I need someone to come out.",
      [
        "It's a 2018 Honda Civic.",
        "I'm Priya, my cell is (678) 555-0144.",
        "Honestly I'd rather not say exactly where it is.",
        "Like I said, I'd prefer not to give a location right now.",
        "I'm really not comfortable sharing the location.",
      ],
      { maxTurns: 7 }
    );
    verdict(!!lead, "captured a partial lead instead of looping forever");
    if (lead) verdict(lead.needsReview === true, "flagged needsReview for the missing location");
  }

  // c) Pricing question. Expect: answers + pivots to gathering (no capture yet).
  {
    const { lead } = await probe("pricing question", "What'll it cost to fix my brakes?", [
      "It's a 2016 Toyota Camry, the brakes feel soft.",
    ]);
    verdict(!lead, "handles pricing and pivots to gathering (no premature capture)");
  }

  // d) Vague vehicle the customer can't identify. Part B: push once (door-jamb
  //    sticker), then capture with make/model empty rather than dropping them.
  {
    const { lead } = await probe(
      "unknown vehicle (no make/model)",
      "My car is making a grinding noise when I brake.",
      [
        "It's parked in my driveway at 88 Maple Court, Canton GA.",
        "I'm Sam, you can reach me at (770) 555-0101.",
        "I honestly don't know the make or model, it's just my car.",
        "I checked, I really can't tell — no idea on the year or make either.",
        "It still drives okay, I'd just like it looked at this week.",
        "Anytime is fine, just call this number.",
      ],
      { maxTurns: 9 }
    );
    verdict(!!lead, "captured with a known location despite unknown vehicle");
    if (lead)
      verdict(
        !lead.vehicleMake || !lead.vehicleModel,
        "captured partial vehicle (make/model left empty, not invented)"
      );
  }
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
