import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { toDashboardLead } from "@/lib/leadShape";

/**
 * PATCH /api/leads/:id — persist a dashboard mutation.
 *   - dismiss:  { dismissedAt: <any non-null>, dismissedBy?: string }
 *   - restore:  { dismissedAt: null }
 *   - status:   { status: "new" | "contacted" | "scheduled" }
 * The dashboard updates optimistically, then calls this to save.
 */
export const runtime = "nodejs";

const STATUSES = ["new", "contacted", "scheduled"];

type PatchBody = {
  status?: unknown;
  dismissedAt?: unknown;
  dismissedBy?: unknown;
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const data: {
    status?: string;
    dismissedAt?: Date | null;
    dismissedBy?: string | null;
  } = {};

  if ("status" in body) {
    if (typeof body.status !== "string" || !STATUSES.includes(body.status)) {
      return NextResponse.json(
        { ok: false, error: "Invalid status." },
        { status: 422 }
      );
    }
    data.status = body.status;
  }

  if ("dismissedAt" in body) {
    if (body.dismissedAt === null) {
      data.dismissedAt = null;
      data.dismissedBy = null;
    } else {
      data.dismissedAt = new Date();
      data.dismissedBy =
        typeof body.dismissedBy === "string" ? body.dismissedBy : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nothing to update." },
      { status: 422 }
    );
  }

  try {
    const updated = await prisma.lead.update({ where: { id }, data });
    return NextResponse.json({ ok: true, lead: toDashboardLead(updated) });
  } catch (err) {
    console.error(`PATCH /api/leads/${id} failed:`, err);
    return NextResponse.json(
      { ok: false, error: "Could not update that lead." },
      { status: 404 }
    );
  }
}
