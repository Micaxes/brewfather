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

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
