import type { Lead } from "@prisma/client";

/**
 * Map a persisted Lead row to the exact object shape AigentOS.jsx renders.
 * Dates go out as ISO strings over JSON; the dashboard rehydrates them to Date
 * objects on receipt (so sorting and daysLeft work). `phone`/`callback` are
 * coalesced to "" because the dashboard calls digits(phone) and renders both
 * directly.
 */
export function toDashboardLead(l: Lead) {
  return {
    id: l.id,
    name: l.name,
    phone: l.phone ?? "",
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    urgency: l.urgency,
    status: l.status,
    callback: l.callback ?? "",
    summary: l.summary,
    vehicleYear: l.vehicleYear,
    vehicleMake: l.vehicleMake,
    vehicleModel: l.vehicleModel,
    needsReview: l.needsReview,
    convo: l.convo,
    createdAt: l.createdAt,
    dismissedAt: l.dismissedAt,
    dismissedBy: l.dismissedBy,
  };
}
