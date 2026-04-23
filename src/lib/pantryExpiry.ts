/** Days until expiry (inclusive of expiry day) that trigger the “soon” styling */
export const PANTRY_EXPIRY_WARNING_DAYS = 7;

export type PantryExpiryDisplayStatus =
  | "none"
  | "ok"
  | "expiringSoon"
  | "expired";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseExpiresOnParts(
  expiresOn: string
): { y: number; m: number; d: number } | null {
  const m = ISO_DATE.exec(expiresOn.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return { y, m: mo, d };
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function calendarDaysFromTo(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function getPantryExpiryDisplayStatus(
  expiresOn: string | null,
  now: Date = new Date()
): PantryExpiryDisplayStatus {
  if (!expiresOn) return "none";
  const parts = parseExpiresOnParts(expiresOn);
  if (!parts) return "none";
  const expiryDay = new Date(parts.y, parts.m - 1, parts.d);
  const diff = calendarDaysFromTo(now, expiryDay);
  if (diff < 0) return "expired";
  if (diff <= PANTRY_EXPIRY_WARNING_DAYS) return "expiringSoon";
  return "ok";
}

export function formatExpiresOnLabel(expiresOn: string): string {
  const parts = parseExpiresOnParts(expiresOn);
  if (!parts) return expiresOn;
  const d = new Date(parts.y, parts.m - 1, parts.d);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Short sentence for icon+text row (expired / expiringSoon); null if none/ok */
export function getPantryExpiryAlertMessage(
  expiresOn: string | null,
  now: Date = new Date()
): string | null {
  const status = getPantryExpiryDisplayStatus(expiresOn, now);
  if (status === "none" || status === "ok") return null;
  if (!expiresOn) return null;
  const parts = parseExpiresOnParts(expiresOn);
  if (!parts) return null;
  const expiryDay = new Date(parts.y, parts.m - 1, parts.d);
  const diff = calendarDaysFromTo(now, expiryDay);
  if (status === "expired") {
    const n = -diff;
    return n === 1 ? "Expired yesterday" : `Expired ${n} days ago`;
  }
  if (diff === 0) return "Expires today";
  if (diff === 1) return "Expires tomorrow";
  return `Expires in ${diff} days`;
}
