/**
 * =============================================================================
 * TENANT CONFIGURATION — the receptionist's business context
 * =============================================================================
 * The receptionist's system prompt is built from this file (see
 * src/lib/receptionist.ts → buildSystemPrompt). To run the brain for a
 * different business, edit only this file.
 *
 * This tenant is a MOBILE MECHANIC — an auto-repair business where the
 * mechanic drives to wherever the customer's vehicle is (driveway, parking
 * lot, roadside, workplace) rather than the customer coming to a shop.
 *
 * ⚠️ PLACEHOLDERS: the fields marked `TODO(tenant)` below are skeleton values,
 * NOT a real business. Fill them in with the real, verified details before
 * going live — never publish unverified claims (name, hours, phone, area).
 * =============================================================================
 */

export type BusinessHours = {
  day: string;
  opens: string | null; // "08:00" 24h, or null when closed
  closes: string | null; // "18:00" 24h, or null when closed
};

export const business = {
  /** ----- Identity ----- */
  // TODO(tenant): real business name. Do not use a placeholder in production.
  name: "TODO: Mobile mechanic business name",
  // Stable slug used to scope leads to this tenant in the database.
  // TODO(tenant): set a real slug (lowercase, dashed) before going live.
  slug: "mobile-mechanic-demo",
  // TODO(tenant): the geographic area the mechanic will drive to.
  primaryServiceArea: "TODO: primary service area (e.g. the greater Austin, TX area)",
  // TODO(tenant): one-line description of the mobile mechanic service.
  longDescription:
    "TODO: one-line description — e.g. a mobile mechanic that comes to the customer's vehicle for on-the-spot diagnostics and repairs, from dead batteries and no-starts to brakes and routine maintenance.",

  /** ----- Contact ----- */
  phone: {
    // TODO(tenant): real, verified dispatch number shown to customers.
    display: "TODO: (555) 555-0000",
    // TODO(tenant): same number in E.164 for tel: links.
    e164: "TODO: +15555550000",
  },

  /**
   * Business hours, used in the system prompt.
   * TODO(tenant): set the real dispatch hours. These are placeholder defaults.
   */
  hours: [
    { day: "Monday", opens: "07:00", closes: "19:00" },
    { day: "Tuesday", opens: "07:00", closes: "19:00" },
    { day: "Wednesday", opens: "07:00", closes: "19:00" },
    { day: "Thursday", opens: "07:00", closes: "19:00" },
    { day: "Friday", opens: "07:00", closes: "19:00" },
    { day: "Saturday", opens: "08:00", closes: "17:00" },
    { day: "Sunday", opens: null, closes: null },
  ] as BusinessHours[],
} as const;

export const businessName = business.name;
