/**
 * =============================================================================
 * THE AI RECEPTIONIST — the "brain"
 * =============================================================================
 * One brain, three pipes. The channels (web chat, SMS, voice) are just
 * transports that feed text in and take text out. This module is the brain:
 * one system prompt, one tool (`capture_lead`), and a single function that
 * carries a conversation and decides when it has enough to fire the tool.
 *
 * See docs/RECEPTIONIST.md in the handoff for the design. The `capture_lead`
 * input maps 1:1 to the dashboard's Lead object; `channel`, `status`,
 * `createdAt`, and the transcript (`convo`) are filled by the caller (the
 * route), not the model.
 *
 * Persistence is intentionally out of scope here — this is step 1 (prove the
 * brain with hardcoded messages, no DB writes). The route returns the captured
 * Lead; wiring it to Prisma is the next step.
 * =============================================================================
 */

import Anthropic from "@anthropic-ai/sdk";

import { business } from "@/config/business";

/** Model used for the receptionist's reasoning. */
const MODEL = "claude-sonnet-4-6";

/** A turn in the customer-facing transcript, as the dashboard renders it. */
export type ConvoTurn = { who: "ai" | "cust"; text: string };

export type Channel = "web" | "sms" | "voice";
export type Urgency = "emergency" | "soon" | "flexible";

/** The structured arguments the model produces when it calls `capture_lead`. */
export type CaptureLeadInput = {
  customer_name: string;
  phone?: string;
  /** Where the vehicle is RIGHT NOW (its current location), not a home address. */
  address: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  urgency: Urgency;
  summary: string;
  callback?: string;
  /** Set true when captured with gaps (no findable location, unknown vehicle). */
  needs_review?: boolean;
};

/**
 * The Lead object the dashboard renders. The receptionist fills the
 * customer-derived fields via `capture_lead`; the route fills `channel`,
 * `status`, `createdAt`, and `convo`. `lat`/`lng` come from geocoding the
 * address later (out of scope for step 1).
 */
export type Lead = {
  name: string;
  phone: string | null;
  /** The vehicle's CURRENT location (roadside, lot, driveway, etc.). */
  address: string;
  lat: number | null;
  lng: number | null;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  channel: Channel;
  urgency: Urgency;
  status: "new" | "contacted" | "scheduled";
  callback: string | null;
  summary: string;
  needsReview: boolean;
  convo: ConvoTurn[];
  createdAt: string;
};

/** A message in the conversation, as exchanged with the route. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/** The `capture_lead` tool — Anthropic tool-use schema (see docs/RECEPTIONIST.md). */
export const captureLeadTool: Anthropic.Tool = {
  name: "capture_lead",
  description:
    "Record a qualified mobile-mechanic service lead. Call this exactly once, " +
    "as soon as you have the customer's name, a SPECIFIC dispatchable address " +
    "where the vehicle is, a clear description of what's wrong, and an urgency " +
    "level. Vehicle year/make/model are OPTIONAL — capture without them if the " +
    "customer doesn't know. NEVER call this without a specific, findable address.",
  input_schema: {
    type: "object",
    properties: {
      customer_name: { type: "string", description: "Customer's full name." },
      phone: {
        type: "string",
        description:
          "Best contact number. Use the channel's number if not stated.",
      },
      address: {
        type: "string",
        description:
          "A SPECIFIC, dispatchable location of the vehicle RIGHT NOW that the " +
          "mechanic could actually drive to — a street address, or a clearly " +
          "identified spot like 'the Kroger on Old Hwy 5' or 'I-575 N at the " +
          "Riverstone Pkwy exit'. NOT acceptable: 'my house', 'on the road', " +
          "'a parking lot', 'somewhere'. If you don't have something findable, " +
          "do NOT call this tool — keep politely asking for the address.",
      },
      vehicle_year: {
        type: "string",
        description: "Vehicle model year, e.g. '2014'. Empty if not given.",
      },
      vehicle_make: {
        type: "string",
        description:
          "Vehicle make, e.g. 'Chevrolet', 'Toyota', 'Ford'. Empty if the " +
          "customer genuinely doesn't know it.",
      },
      vehicle_model: {
        type: "string",
        description:
          "Vehicle model, e.g. 'Silverado', 'Camry', 'F-150'. Empty if the " +
          "customer genuinely doesn't know it.",
      },
      urgency: {
        type: "string",
        enum: ["emergency", "soon", "flexible"],
      },
      summary: {
        type: "string",
        description:
          "One sentence, in your words, describing the symptoms and any key " +
          "detail (e.g. 'no-start, stranded on the highway shoulder at night'). " +
          "If the vehicle make/model is unknown, note that here too.",
      },
      callback: {
        type: "string",
        description:
          "When/how to reach them, e.g. 'after 3pm' or 'texts preferred'. " +
          "Empty if not given.",
      },
      needs_review: {
        type: "boolean",
        description:
          "Set true when you had to capture with a gap a human must close — " +
          "e.g. an unknown vehicle make/model. False for a complete lead.",
      },
    },
    required: ["customer_name", "address", "urgency", "summary"],
  },
};

/**
 * The `end_conversation` tool — the model calls this once the customer has no
 * more questions (AFTER a lead was captured) to signal the conversation is over.
 * The route responds by sending the single hard-coded closing line, so the
 * closer is reliable and identical but never premature or repeated.
 */
export const endConversationTool: Anthropic.Tool = {
  name: "end_conversation",
  description:
    "Call this to END the conversation, ONLY after a lead has already been " +
    "captured AND the customer has no more questions. Do NOT write your own " +
    "goodbye — the system sends the final closing line. Provide the customer's " +
    "name and phone so the closer can address them.",
  input_schema: {
    type: "object",
    properties: {
      customer_name: {
        type: "string",
        description: "The customer's name, for the closing line.",
      },
      phone: {
        type: "string",
        description: "The customer's contact number, if known. Empty if not.",
      },
    },
    required: ["customer_name"],
  },
};

/** Human-readable hours line, e.g. "Mon–Fri 7:30 AM–6:00 PM, Sat 8:00 AM–2:00 PM, Sun closed". */
function formatHours(): string {
  const to12h = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  };
  return business.hours
    .map((h) =>
      h.opens && h.closes
        ? `${h.day} ${to12h(h.opens)}–${to12h(h.closes)}`
        : `${h.day} closed`
    )
    .join(", ");
}

/**
 * Build the system prompt for this tenant. Pulls persona + business context
 * from the central business config so the same brain works for any tenant.
 */
export function buildSystemPrompt(channel: Channel): string {
  const mechanic = business.mechanicName?.trim() || "the mechanic";

  // The mechanic's phone is intentionally NOT disclosed to customers — dispatch
  // contacts them, not the other way around.
  return `You are the dispatcher for ${business.name}, a MOBILE MECHANIC serving ${business.primaryServiceArea}. ${business.longDescription}
Hours: ${formatHours()}.

This is a mobile mechanic: the mechanic drives out to wherever the customer's vehicle is — a driveway, a parking lot, the roadside, a workplace. The customer does NOT come to a shop.

Your job: have a short, warm, natural conversation with whoever messages in, and gather everything dispatch needs to send a mechanic to the vehicle. You are not a chatbot reading a script — you sound like a competent dispatcher who works here.

RETURNING CUSTOMERS — check this FIRST, before starting intake: if the customer clearly signals in their OWN words that they've used ${business.name} before or already have a relationship with ${mechanic} (e.g. "it's Ethan again", "you guys worked on my truck last month", "I'm a returning customer", "you fixed my car before", "${mechanic} helped me last time", "I've used you before"), do NOT run intake and do NOT call capture_lead. Instead, in ONE short, friendly reply: warmly welcome them back (use their name if given), and tell them that since they've worked with ${mechanic} before, the fastest thing is to reach out to him directly the way they did last time — he'll take care of them. Do NOT give out a phone number (a returning customer already has it), and do NOT ask for vehicle, location, or problem details. This is a brief redirect, not an intake.
Only redirect when they CLEARLY reference a prior service relationship with this business. If it's ambiguous — they're just friendly, or say "hey again" with no reference to past service — treat them as a NEW customer and run normal intake; never strand a new customer by wrongly redirecting them. If someone starts as a new customer (describes a problem) and only later mentions they're returning, use judgment: if intake is basically done, finish normally and capture the lead; only redirect if they clearly just want to deal with ${mechanic} directly.

Collect, conversationally (don't interrogate, don't ask for everything at once):
  - the customer's name
  - their phone number (if not already known from the channel)
  - WHERE THE VEHICLE IS RIGHT NOW — a SPECIFIC, dispatchable location (see below)
  - what's wrong (the symptoms, in the customer's own words)
  - how urgent it is
  - the vehicle's year, make, and model (nice to have, but optional)
  - when's a good time to reach them (callback preference)

TWO THINGS ARE REQUIRED before you can capture a lead: the customer's NAME and a SPECIFIC, DISPATCHABLE ADDRESS. Politely insist on both — "I just need a name and an address so we can get someone out to you." The address must be somewhere the mechanic could actually drive to: a street address, or a clearly identified spot ("the Kroger on Old Hwy 5", "I-575 north at the Riverstone exit"). NOT good enough: "my house", "on the road", "a parking lot", "somewhere". If what they give isn't findable, warmly keep asking until it is — do NOT capture_lead without a real address, ever. There is no exception for this; without a findable address there is no lead.

Vehicle details — stay EASYGOING: ask once for the year/make/model, and if they're not sure suggest the sticker in the driver's door jamb or the registration. But if they don't know, that's totally fine — capture without it, leave make/model empty, set needs_review=true, and DON'T nag. Never invent a vehicle.

Urgency rubric (mobile mechanic):
  - emergency  → stranded, roadside, unsafe, blocking traffic, or broken down away from home — especially at night or on a highway. e.g. "won't restart, dead on the shoulder of I-575."
  - soon       → won't start or undrivable but in a safe spot (driveway, home, lot); wants it handled today.
  - flexible   → drivable: routine maintenance, odd noises, soft brakes, quotes, "sometime this week."

Urgency — ask AT MOST ONCE. Don't interrogate about it. If the customer answers vaguely ("idk", "just fix it", "I want it fixed bro") or shows any impatience, do NOT re-ask — INFER a reasonable urgency from what they've already told you (a drivable car with a recurring or ongoing issue → soon; stranded, roadside, or unsafe → emergency; routine maintenance or a quote → flexible) and move on. Never re-ask a question the customer already answered or deflected. Impatience is a signal to wrap up, not to probe further.

PRICE / QUOTE QUESTIONS: if the customer asks what something costs ("what's an alternator cost?"), do NOT ignore it and do NOT invent or estimate a number. Say plainly that you can't quote a price, but ${mechanic} will go over the cost with them when he reaches out — then continue gathering the name + address (or, if you've already captured, just answer and carry on). Never promise a specific price or a specific arrival time.

CAPTURING AND CLOSING — follow this order:
  1. Once you have the name + a specific address + a clear problem + urgency, call capture_lead exactly ONCE (include make/model only if known). Do NOT call it again later in the same conversation.
  2. After capturing, do NOT say goodbye. Briefly confirm you've got their info and that ${mechanic} will be in touch, then ASK if they have any other questions.
  3. Answer whatever they ask next (e.g. a price question, per the rule above). Keep helping until they're done.
  4. When the customer has no more questions (or clearly wants to wrap up), call end_conversation with their name and phone. Do NOT write your own closing line — the system sends the final sign-off. Only call end_conversation after a lead has been captured.

Tone: warm, competent, and efficient. Keep replies short — this is a ${channel} conversation, not email.`;
}

/**
 * Assemble the dashboard Lead from the model's tool input plus
 * caller-supplied context.
 */
export function buildLead(
  input: CaptureLeadInput,
  channel: Channel,
  convo: ConvoTurn[]
): Lead {
  return {
    name: input.customer_name,
    phone: input.phone?.trim() || null,
    address: input.address,
    lat: null,
    lng: null,
    vehicleYear: input.vehicle_year?.trim() || null,
    vehicleMake: input.vehicle_make?.trim() || null,
    vehicleModel: input.vehicle_model?.trim() || null,
    channel,
    urgency: input.urgency,
    status: "new",
    callback: input.callback?.trim() || null,
    summary: input.summary,
    needsReview: input.needs_review ?? false,
    convo,
    createdAt: new Date().toISOString(),
  };
}

/** The customer-identifying fields the closer needs, from `end_conversation`. */
export type ConversationEnd = { customerName: string; phone: string | null };

/** The result of one receptionist turn. */
export type ReceptionistResult = {
  /** The assistant's text reply to send back to the customer. */
  reply: string;
  /** The captured Lead, if `capture_lead` fired this turn; otherwise null. */
  lead: Lead | null;
  /**
   * Set when `end_conversation` fired this turn — the customer is done, so the
   * route should send the final hard-coded closing line. Null otherwise.
   */
  end: ConversationEnd | null;
};

/**
 * Run one turn of the receptionist over a conversation.
 *
 * Calls Claude with the system prompt and two tools. `capture_lead` builds and
 * returns the Lead (the route persists it and the model confirms + asks if
 * there's anything else). `end_conversation` signals the customer is done, so
 * the route can send the single hard-coded closer — reliable and identical, but
 * never premature or repeated.
 */
export async function runReceptionist(
  messages: ChatMessage[],
  channel: Channel = "web",
  client: Anthropic = new Anthropic()
): Promise<ReceptionistResult> {
  const system = buildSystemPrompt(channel);
  const convo = toConvo(messages);
  const tools = [captureLeadTool, endConversationTool];

  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const first = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system,
    tools,
    messages: apiMessages,
  });

  const toolUse = first.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (!toolUse) {
    return { reply: textOf(first), lead: null, end: null };
  }

  // The customer is done — hand the closer back to the route to send verbatim.
  if (toolUse.name === "end_conversation") {
    const input = toolUse.input as { customer_name?: string; phone?: string };
    return {
      reply: textOf(first),
      lead: null,
      end: {
        customerName: input.customer_name ?? "",
        phone: input.phone?.trim() || null,
      },
    };
  }

  // The model captured a lead. Build it, then send a tool_result so the model
  // can confirm and ask if there's anything else (NOT a goodbye — the closer is
  // sent later, when end_conversation fires).
  const lead = buildLead(toolUse.input as CaptureLeadInput, channel, convo);

  const followUp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system,
    tools,
    messages: [
      ...apiMessages,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ status: "captured" }),
          },
        ],
      },
    ],
  });

  // Prefer any text the model produced alongside the tool call; otherwise use
  // the confirmation it generates after the tool_result.
  const reply = textOf(first) || textOf(followUp);
  return { reply, lead, end: null };
}

/** Concatenate the text blocks of a response into a single string. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Convert the API message list to the dashboard's transcript shape. */
function toConvo(messages: ChatMessage[]): ConvoTurn[] {
  return messages.map((m) => ({
    who: m.role === "assistant" ? "ai" : "cust",
    text: m.content,
  }));
}
