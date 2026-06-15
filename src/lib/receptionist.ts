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
const MODEL = "claude-opus-4-8";

/** A turn in the customer-facing transcript, as the dashboard renders it. */
export type ConvoTurn = { who: "ai" | "cust"; text: string };

export type Channel = "web" | "sms" | "voice";
export type Urgency = "emergency" | "soon" | "flexible";

/** The structured arguments the model produces when it calls `capture_lead`. */
export type CaptureLeadInput = {
  customer_name: string;
  phone?: string;
  address: string;
  urgency: Urgency;
  summary: string;
  callback?: string;
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
  address: string;
  lat: number | null;
  lng: number | null;
  channel: Channel;
  urgency: Urgency;
  status: "new" | "contacted" | "scheduled";
  callback: string | null;
  summary: string;
  convo: ConvoTurn[];
  createdAt: string;
};

/** A message in the conversation, as exchanged with the route. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/** The `capture_lead` tool — Anthropic tool-use schema (see docs/RECEPTIONIST.md). */
export const captureLeadTool: Anthropic.Tool = {
  name: "capture_lead",
  description:
    "Record a qualified service lead once enough detail has been gathered. " +
    "Call this exactly once, when you have the customer's name, service " +
    "address, a clear description of the problem, and an urgency level.",
  input_schema: {
    type: "object",
    properties: {
      customer_name: { type: "string", description: "Customer's full name." },
      phone: {
        type: "string",
        description:
          "Best contact number. Use the channel's number if not stated.",
      },
      address: { type: "string", description: "Full service address." },
      urgency: {
        type: "string",
        enum: ["emergency", "soon", "flexible"],
      },
      summary: {
        type: "string",
        description:
          "One sentence, in your words, describing the problem and any key " +
          "detail (e.g. infant at home).",
      },
      callback: {
        type: "string",
        description:
          "When/how to reach them, e.g. 'after 3pm' or 'texts preferred'. " +
          "Empty if not given.",
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

  return `You are the receptionist for ${business.name}, serving ${business.primaryServiceArea}. ${business.longDescription}${phoneLine}
Hours: ${formatHours()}.

Your job: have a short, warm, natural conversation with whoever messages in, and gather everything needed to get them on the schedule. You are not a chatbot reading a script — you sound like a competent person who works here.

Collect, conversationally (don't interrogate, don't ask for everything at once):
  - the customer's name
  - their phone number (if not already known from the channel)
  - the service address
  - what's going on (the problem, in their words)
  - how urgent it is
  - when's a good time to reach them (callback preference)

Urgency rubric:
  - emergency  → safety, active damage, someone stranded or vulnerable (infants, elderly, medical), or a total loss of something essential in harsh conditions. e.g. "no AC, 84°, baby at home" or "broken down on the shoulder of the highway at night."
  - soon       → broken or degraded but not dangerous; wants it handled this week.
  - flexible   → maintenance, routine service, quotes, no current problem.

When you have name + address + a clear problem + urgency, call capture_lead with the structured details, then warmly confirm to the customer that the team will follow up (reference their callback preference if given). Do NOT promise a specific appointment time — you capture the request; a human or the scheduler confirms.

If they only want a quote or have no real issue, that's fine — capture it as flexible. Never invent details. If something's missing and they go quiet, ask once more for the single most important missing piece (usually the address).

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
    channel,
    urgency: input.urgency,
    status: "new",
    callback: input.callback?.trim() || null,
    summary: input.summary,
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
    thinking: { type: "adaptive" },
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
    thinking: { type: "adaptive" },
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
