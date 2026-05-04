/** Shared option lists for investor profile fields. Mirrors server enums. */

export const EXPERIENCE_OPTIONS = [
  { value: "BEGINNER",     label: "Beginner — just starting out" },
  { value: "INTERMEDIATE", label: "Intermediate — a few years in" },
  { value: "ADVANCED",     label: "Advanced — comfortable with derivatives, options, etc." }
] as const;

export const RISK_OPTIONS = [
  { value: "CONSERVATIVE", label: "Conservative — capital protection first" },
  { value: "MODERATE",     label: "Moderate — balanced growth and safety" },
  { value: "AGGRESSIVE",   label: "Aggressive — high growth, accept volatility" }
] as const;

export const INCOME_OPTIONS = [
  { value: "UNDER_5L",        label: "Below ₹5 lakh" },
  { value: "5L_10L",          label: "₹5 — 10 lakh" },
  { value: "10L_25L",         label: "₹10 — 25 lakh" },
  { value: "25L_50L",         label: "₹25 — 50 lakh" },
  { value: "OVER_50L",        label: "Above ₹50 lakh" },
  { value: "PREFER_NOT_SAY",  label: "Prefer not to say" }
] as const;

export const GOAL_OPTIONS = [
  { value: "RETIREMENT", label: "Retirement" },
  { value: "WEALTH",     label: "Wealth creation" },
  { value: "CHILD_EDU",  label: "Children's education" },
  { value: "HOME",       label: "Buying a home" },
  { value: "SHORT_TERM", label: "Short-term goals" },
  { value: "TAX_SAVING", label: "Tax saving" }
] as const;

/** Pretty labels for read-only display. */
export const labelFor = {
  experience: (v?: string | null) => EXPERIENCE_OPTIONS.find((o) => o.value === v)?.label ?? "—",
  risk:       (v?: string | null) => RISK_OPTIONS.find((o) => o.value === v)?.label ?? "—",
  income:     (v?: string | null) => INCOME_OPTIONS.find((o) => o.value === v)?.label ?? "—",
  goal:       (v?: string | null) => GOAL_OPTIONS.find((o) => o.value === v)?.label ?? v
};
