/** Display helpers for the brew dashboard. */

/** A brewability score (0–1) as a whole-number percentage, e.g. 0.88 -> "88%". */
export function formatScore(score: number): string {
  return `${Math.round(clamp01(score) * 100)}%`;
}

/** A quantity + unit with float noise trimmed, e.g. 0.5 "kg" -> "0.5 kg", 50 "g" -> "50 g". */
export function formatQuantity(amount: number, unit: string): string {
  const rounded = Number(amount.toFixed(3));
  return unit ? `${rounded} ${unit}` : `${rounded}`;
}

/**
 * An ISO timestamp as a coarse relative phrase for the "Last synced" label:
 * "just now" (0–59 s), then minutes, hours, days. Future/invalid timestamps
 * clamp to "just now" / "" rather than producing negative ages.
 */
export function formatRelativeTime(
  iso: string,
  now: number = Date.now()
): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
