import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  runReceptionist,
  type Channel,
  type ChatMessage,
} from "@/lib/receptionist";
import { prisma } from "@/lib/prisma";
import { geocode } from "@/lib/geocode";
import { business } from "@/config/business";

/**
 * The receptionist endpoint — one brain, reused by every channel.
 *
 *   POST /api/chat
 *   { messages: [{ role: "user" | "assistant", content: string }], channel? }
 *
 * Loads the system prompt + `capture_lead` tool, calls Claude, returns the
 * reply, and — when the tool fires — the structured Lead the dashboard renders.
 *
 * Step 1 (per docs/RECEPTIONIST.md): no persistence yet. The captured Lead is
 * returned to the caller; writing it to Postgres via Prisma is the next step.
 * SMS and voice are just other transports that POST the same shape here.
 */

export const runtime = "nodejs";

const VALID_CHANNELS: Channel[] = ["web", "sms", "voice"];

type ChatRequest = {
  messages?: unknown;
  channel?: unknown;
  /**
   * The lead already captured earlier this conversation, echoed back by the
   * client (the brain is stateless per call). Its presence is how the route
   * knows a lead exists so it can fire the closer in code on a closing reply —
   * no second model call, no dependence on the model choosing to end.
   */
  captured?: unknown;
};

/** What the client echoes back so the route can build the closer in code. */
type CapturedLead = { name: string | null; phone: string | null };

function parseCaptured(value: unknown): CapturedLead | null {
  if (typeof value !== "object" || value === null) return null;
  const c = value as Record<string, unknown>;
  const name = typeof c.name === "string" ? c.name : null;
  const phone = typeof c.phone === "string" ? c.phone : null;
  if (!name && !phone) return null;
  return { name, phone };
}

/**
 * Does this message clearly mean "I'm done, nothing more"? Used ONLY after a
 * lead is captured, to fire the closer in code. Deliberately conservative: a
 * message containing a question ("?") is never treated as a close.
 */
function isClosingSignal(text: string): boolean {
  const t = text
    .toLowerCase()
    .trim()
    .replace(/[.!,]+$/g, "")
    .trim();
  if (!t || t.includes("?")) return false;

  const exact = new Set([
    "no",
    "nope",
    "nah",
    "naw",
    "n",
    "no thanks",
    "no thank you",
    "nothing",
    "nothing else",
    "that's it",
    "thats it",
    "that's all",
    "thats all",
    "that's everything",
    "thats everything",
    "i'm good",
    "im good",
    "we're good",
    "were good",
    "all good",
    "all set",
    "i'm all set",
    "im all set",
    "good for now",
    "that'll do",
    "thatll do",
    "thanks",
    "thank you",
    "thx",
    "ty",
    "cool thanks",
    "ok thanks",
    "okay thanks",
    "great thanks",
    "perfect thanks",
    "no that's it",
    "no thats it",
    "no that's all",
    "no thats all",
    "no im good",
    "no i'm good",
  ]);
  if (exact.has(t)) return true;

  // Short negative/closing openers ("no that's all I need", "nope we're good").
  if (/^(no|nope|nah|naw)\b/.test(t) && t.length <= 40) return true;

  return false;
}

/**
 * The single, exact closing line shown after a lead is captured. Built in code
 * (never by the model) so it's identical every time. Placeholders fall back
 * gracefully so the line never renders "undefined"/"null" or a dangling gap:
 *   - no name  → "All set." (no dangling comma)
 *   - no phone → drop the " at {phone}" clause
 *   - no mechanicName → "Our mechanic"
 */
function buildClosingLine(name: string | null, phone: string | null): string {
  const mechanic = business.mechanicName?.trim() || "Our mechanic";
  const customer = name?.trim();
  const phoneTrimmed = phone?.trim();

  const opener = customer ? `All set, ${customer}.` : "All set.";
  const atPhone = phoneTrimmed ? ` at ${phoneTrimmed}` : "";

  return `${opener} ${mechanic} will contact you${atPhone} shortly to arrange a time to come out and take a look. Thanks for reaching out.`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim().length > 0
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set");
    return NextResponse.json(
      { ok: false, error: "Receptionist is not configured." },
      { status: 503 }
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { ok: false, error: "`messages` must be a non-empty array." },
      { status: 422 }
    );
  }
  if (!body.messages.every(isChatMessage)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Each message needs a role ('user' or 'assistant') and non-empty string content.",
      },
      { status: 422 }
    );
  }
  if (body.messages[0].role !== "user") {
    return NextResponse.json(
      { ok: false, error: "The first message must be from the user." },
      { status: 422 }
    );
  }

  const channel: Channel =
    typeof body.channel === "string" &&
    VALID_CHANNELS.includes(body.channel as Channel)
      ? (body.channel as Channel)
      : "web";

  // CODE-DRIVEN CLOSE: once a lead has been captured (echoed back as `captured`),
  // the moment the customer's latest message is a closing signal we send the
  // hard-coded closer directly — no model call, so it can NEVER be skipped by
  // the model failing to "decide" to end. This is the reliability fix.
  const captured = parseCaptured(body.captured);
  const lastUser = [...body.messages]
    .reverse()
    .find((m) => m.role === "user");
  if (captured && lastUser && isClosingSignal(lastUser.content)) {
    return NextResponse.json({
      ok: true,
      reply: buildClosingLine(captured.name, captured.phone),
      lead: null,
    });
  }

  try {
    const { reply, lead } = await runReceptionist(body.messages, channel);

    if (lead) {
      // Geocode the vehicle's current location for the map pin (best-effort).
      const coords = await geocode(lead.address);
      if (coords) {
        lead.lat = coords.lat;
        lead.lng = coords.lng;
      }

      // Persist the captured lead so it shows up live on the dashboard.
      // Best-effort: skip when no DB is configured (e.g. local sandbox), and
      // never let a DB failure drop the customer's reply — log and continue.
      try {
        if (!process.env.DATABASE_URL) {
          throw new Error("DATABASE_URL not set — skipping lead persistence.");
        }
        await prisma.lead.create({
          data: {
            businessSlug: business.slug,
            name: lead.name,
            phone: lead.phone,
            address: lead.address,
            lat: lead.lat,
            lng: lead.lng,
            channel: lead.channel,
            urgency: lead.urgency,
            status: lead.status,
            callback: lead.callback,
            summary: lead.summary,
            vehicleYear: lead.vehicleYear,
            vehicleMake: lead.vehicleMake,
            vehicleModel: lead.vehicleModel,
            needsReview: lead.needsReview,
            convo: lead.convo as unknown as Prisma.InputJsonValue,
            createdAt: new Date(lead.createdAt),
          },
        });
      } catch (dbErr) {
        console.error("Lead persist failed (continuing):", dbErr);
      }
    }

    return NextResponse.json({ ok: true, reply, lead });
  } catch (err) {
    console.error("Receptionist call failed:", err);
    return NextResponse.json(
      { ok: false, error: "The receptionist is unavailable right now." },
      { status: 502 }
    );
  }
}
