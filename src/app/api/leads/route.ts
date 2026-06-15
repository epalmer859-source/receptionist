import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { business } from "@/config/business";
import { toDashboardLead } from "@/lib/leadShape";

/**
 * GET /api/leads — every lead for this tenant, newest first, in the dashboard's
 * lead shape. The dashboard fetches this on mount.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await prisma.lead.findMany({
      where: { businessSlug: business.slug },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, leads: rows.map(toDashboardLead) });
  } catch (err) {
    console.error("GET /api/leads failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not load leads." },
      { status: 500 }
    );
  }
}
