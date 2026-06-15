/**
 * =============================================================================
 * TENANT CONFIGURATION — the receptionist's business context
 * =============================================================================
 * The receptionist's system prompt is built from this file (see
 * src/lib/receptionist.ts → buildSystemPrompt). To run the brain for a
 * different business, edit only this file.
 *
 * NOTE: The values below describe the DEMO pilot tenant ("Summit Air
 * Solutions", a fictional HVAC company). Replace them with the real
 * business's verified information before going live — never publish
 * unverified claims (hours, phone, service area).
 * =============================================================================
 */

export type BusinessHours = {
  day: string;
  opens: string | null; // "08:00" 24h, or null when closed
  closes: string | null; // "18:00" 24h, or null when closed
};

export const business = {
  /** ----- Identity ----- */
  name: "Summit Air Solutions",
  primaryServiceArea: "the north-metro Atlanta area",
  longDescription:
    "Summit Air Solutions is a same-day HVAC company serving the north-metro Atlanta area. We handle heating and cooling repairs, system replacements, and routine maintenance, with a focus on getting customers comfortable again fast.",

  /** ----- Contact ----- */
  phone: {
    /** Human-readable, surfaced to customers in the conversation. */
    display: "(770) 555-0100",
    /** E.164 for tel: links. */
    e164: "+17705550100",
  },

  /** Business hours, used in the system prompt. */
  hours: [
    { day: "Monday", opens: "07:00", closes: "19:00" },
    { day: "Tuesday", opens: "07:00", closes: "19:00" },
    { day: "Wednesday", opens: "07:00", closes: "19:00" },
    { day: "Thursday", opens: "07:00", closes: "19:00" },
    { day: "Friday", opens: "07:00", closes: "19:00" },
    { day: "Saturday", opens: "08:00", closes: "16:00" },
    { day: "Sunday", opens: null, closes: null },
  ] as BusinessHours[],
} as const;

export const businessName = business.name;
