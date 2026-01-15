/**
 * Date helpers shared between the app and web components.
 *
 * IMPORTANT:
 * - `YYYY-MM-DD` strings represent a *local calendar date* (what the user picked).
 * - Convert to UTC instants only when querying the backend.
 */

export function formatLocalYMD(date) {
  const dt = date instanceof Date ? date : new Date(date);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalYMD(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const m = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  // Validate round-trip to avoid JS auto-corrections (e.g. 2026-02-31)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

export function localDateStringToUTCMidnightMs(dateString) {
  const m = dateString?.match?.(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return Date.UTC(y, mo, d);
}

// Convert local YYYY-MM-DD strings to UTC ISO instants covering the selected local range.
export function localRangeToUTCISOs(startLocalYMD, endLocalYMD) {
  const s = parseLocalYMD(startLocalYMD);
  const e = parseLocalYMD(endLocalYMD);
  if (!s || !e) return null;

  const start = new Date(s);
  start.setHours(0, 0, 0, 0);

  const end = new Date(e);
  end.setHours(23, 59, 59, 999);

  return { startUTC: start.toISOString(), endUTC: end.toISOString() };
}


