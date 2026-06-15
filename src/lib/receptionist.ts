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
    "Record a qualified mobile-mechanic service lead once enough detail has " +
    "been gathered. Call this exactly once, when you have the customer's name, " +
    "the vehicle's current location, the vehicle make and model, a clear " +
    "description of what's wrong, and an urgency level.",
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
          "Where the vehicle is RIGHT NOW — its current location, NOT a home " +
          "address. May be a parking lot, roadside, highway shoulder, or a " +
          "workplace. Capture enough for the mechanic to actually find it " +
          "(e.g. 'I-575 N shoulder just past the Riverstone Pkwy exit').",
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
          "If location or vehicle is unknown, note that here too.",
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
          "e.g. no findable vehicle location, or an unknown make/model. " +
          "False for a complete, dispatchable lead.",
      },
    },
    required: ["customer_name", "address", "urgency", "summary"],
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
  const phoneLine = business.phone?.display
    ? ` Our phone number is ${business.phone.display}.`
    : "";

  return `You are the dispatcher for ${business.name}, a MOBILE MECHANIC serving ${business.primaryServiceArea}. ${business.longDescription}${phoneLine}
Hours: ${formatHours()}.

This is a mobile mechanic: the mechanic drives out to wherever the customer's vehicle is — a driveway, a parking lot, the roadside, a workplace. The customer does NOT come to a shop.

Your job: have a short, warm, natural conversation with whoever messages in, and gather everything dispatch needs to send a mechanic to the vehicle. You are not a chatbot reading a script — you sound like a competent dispatcher who works here.

Collect, conversationally (don't interrogate, don't ask for everything at once):
  - the customer's name
  - their phone number (if not already known from the channel)
  - WHERE THE VEHICLE IS RIGHT NOW — this is the vehicle's current location, NOT a home address. It might be a parking lot, the roadside, a highway shoulder, or a workplace. Ask "where's the vehicle right now?" and get something a mechanic could actually find.
  - the vehicle's YEAR, MAKE, and MODEL
  - what's wrong (the symptoms, in the customer's own words)
  - how urgent it is
  - when's a good time to reach them (callback preference)

Vehicle details: push gently for the year/make/model — if they're not sure, suggest the sticker inside the driver's door jamb or the registration. But if the customer genuinely can't give them, DON'T loop on it: capture the lead with the phone, location, and symptoms you do have, leave make/model empty, and set needs_review=true so a human can confirm the vehicle.

No-location escape hatch: the location is the one thing dispatch truly needs. Ask for it, and if it's vague, try ONCE more for something findable (a cross-street, a landmark, a business name). If after about two honest attempts you still can't get a findable location, do NOT keep looping — capture what you have (name + phone + symptoms), put a note like "location unclear, customer may be stranded" in the address field, set needs_review=true, and tell the caller a human will call them right back to pin it down.

Urgency rubric (mobile mechanic):
  - emergency  → stranded, roadside, unsafe, blocking traffic, or broken down away from home — especially at night or on a highway. e.g. "won't restart, dead on the shoulder of I-575."
  - soon       → won't start or undrivable but in a safe spot (driveway, home, lot); wants it handled today.
  - flexible   → drivable: routine maintenance, odd noises, soft brakes, quotes, "sometime this week."

When you have enough to dispatch — name + a vehicle location + a clear description of the problem + urgency (vehicle make/model too whenever you can get them) — call capture_lead with the structured details, then warmly confirm that dispatch will follow up (reference their callback preference if given). Do NOT promise a specific arrival time — you capture the request; dispatch confirms timing.

If they only want a quote or have no real issue, that's fine — capture it as flexible. Never invent a vehicle, a location, or any detail. If something's missing and they go quiet, ask once more for the single most important missing item (usually the vehicle's location, or what the car is doing).

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

/** The result of one receptionist turn. */
export type ReceptionistResult = {
  /** The assistant's text reply to send back to the customer. */
  reply: string;
  /** The captured Lead, if `capture_lead` fired this turn; otherwise null. */
  lead: Lead | null;
};

/**
 * Run one turn of the receptionist over a conversation.
 *
 * Calls Claude with the system prompt and the `capture_lead` tool. If the
 * model fires the tool, we build the Lead, feed a tool_result back, and let the
 * model produce its confirmation reply — so the caller always gets clean
 * assistant text plus the Lead (when one was captured).
 */
export async function runReceptionist(
  messages: ChatMessage[],
  channel: Channel = "web",
  client: Anthropic = new Anthropic()
): Promise<ReceptionistResult> {
  const system = buildSystemPrompt(channel);
  const convo = toConvo(messages);

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
    tools: [captureLeadTool],
    messages: apiMessages,
  });

  const toolUse = first.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (!toolUse) {
    return { reply: textOf(first), lead: null };
  }

  // The model captured a lead. Build it, then send a tool_result so the model
  // can produce its warm confirmation to the customer.
  const lead = buildLead(toolUse.input as CaptureLeadInput, channel, convo);

  const followUp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system,
    tools: [captureLeadTool],
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
  return { reply, lead };
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
