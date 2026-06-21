import { NextRequest, NextResponse } from "next/server";

/**
 * Retell webhook endpoint.
 *
 *   GET  /api/retell/webhook  → liveness check (open it in a browser)
 *   POST /api/retell/webhook  → receives Retell call webhooks
 *
 * Step 1: just prove Retell can reach the deployment (stop the 404). It reads
 * and logs the webhook body, pulls out a few common fields when present, and
 * acknowledges fast with 200. No persistence and no signature verification yet
 * — those come later.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "Retell webhook route is live",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log("🔥 Retell webhook received");
    console.log(JSON.stringify(body, null, 2));

    const event = body?.event ?? null;
    const call = body?.call ?? null;

    console.log("Event:", event);
    console.log("Call ID:", call?.call_id ?? null);
    console.log("From:", call?.from_number ?? null);
    console.log("To:", call?.to_number ?? null);

    return NextResponse.json({
      received: true,
      event,
      call_id: call?.call_id ?? null,
    });
  } catch (error) {
    console.error("❌ Retell webhook error:", error);

    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
