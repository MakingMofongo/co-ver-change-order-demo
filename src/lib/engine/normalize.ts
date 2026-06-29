import type { Baseline, BaselineUnitPrice, LineItem } from "./types";

/** Lowercase, collapse whitespace, strip most punctuation for matching. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9#/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize to a set of words for overlap scoring. */
export function tokens(s: string): Set<string> {
  return new Set(normalizeText(s).split(" ").filter((t) => t.length > 1));
}

/**
 * Match a change-order line item back to a contract baseline entry.
 *
 * A match requires the unit of measure to agree AND at least one of the
 * baseline's keyword phrases to appear in the (normalized) description. This is
 * deliberately conservative: a unit mismatch never matches, so a labor "HR"
 * line can't be priced against a material "EA" line.
 *
 * Returns the matched baseline entry, or null when the line has no contract
 * counterpart (a genuinely new item that needs an estimator's eyes).
 */
export function matchBaseline(
  item: LineItem,
  baseline: Baseline,
): BaselineUnitPrice | null {
  const desc = normalizeText(item.description);
  const unit = item.unit.toUpperCase();

  let best: BaselineUnitPrice | null = null;
  let bestScore = 0;

  for (const entry of baseline.unitPrices) {
    if (entry.unit.toUpperCase() !== unit) continue;

    let score = 0;
    for (const phrase of entry.match) {
      if (desc.includes(normalizeText(phrase))) {
        // Longer phrases are stronger evidence.
        score += normalizeText(phrase).length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}
