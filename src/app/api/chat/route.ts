import { NextRequest, NextResponse } from "next/server";

import {
  runReceptionist,
  type Channel,
  type ChatMessage,
} from "@/lib/receptionist";

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
};

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

  try {
    const { reply, lead } = await runReceptionist(body.messages, channel);
    return NextResponse.json({ ok: true, reply, lead });
  } catch (err) {
    console.error("Receptionist call failed:", err);
    return NextResponse.json(
      { ok: false, error: "The receptionist is unavailable right now." },
      { status: 502 }
    );
  }
}
