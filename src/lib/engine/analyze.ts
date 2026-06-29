import { matchBaseline, normalizeText, tokens } from "./normalize";
import type {
  Baseline,
  ChangeOrder,
  Flag,
  ReviewResult,
  ReviewSummary,
  Severity,
} from "./types";

/** A change-order unit price within this % of baseline is treated as in-line. */
export const OVER_BASELINE_TOLERANCE_PCT = 5;
/** Rounding slack (dollars) for math/rollup reconciliation. */
const MONEY_EPS = 1.0;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

let counter = 0;
function flagId(): string {
  return `flag-${counter++}`;
}

function bySeverity(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s];
}

/**
 * Review a change order against the contract baseline.
 *
 * Pure and deterministic. Every flag carries the numbers it was computed from,
 * so a human estimator can audit (and approve/dispute) each one. Feeding a
 * different change order produces a different set of flags — nothing is canned.
 */
export function analyzeChangeOrder(
  co: ChangeOrder,
  baseline: Baseline,
): Flag[] {
  counter = 0;
  const flags: Flag[] = [];
  const scopeTokens = tokens(co.statedScope);

  // --- Line-level checks ------------------------------------------------
  const seen = new Map<string, string>(); // normalized desc+unit -> first item id

  for (const item of co.lineItems) {
    // Math error: billed extended must equal qty x unit price.
    const computedExt = round2(item.quantity * item.unitPrice);
    const extDelta = round2(item.extendedAmount - computedExt);
    if (Math.abs(extDelta) > MONEY_EPS) {
      const overstated = extDelta > 0;
      flags.push({
        id: flagId(),
        type: "math_error",
        severity: overstated ? (extDelta >= 1000 ? "high" : "medium") : "low",
        lineItemId: item.id,
        title: "Extended amount does not equal qty x unit price",
        detail: `${item.quantity} x $${item.unitPrice.toFixed(2)} = $${computedExt.toFixed(2)}, but the line bills $${item.extendedAmount.toFixed(2)} — a ${overstated ? "$" + extDelta.toFixed(2) + " overstatement" : "$" + Math.abs(extDelta).toFixed(2) + " understatement"}.`,
        exposure: Math.max(0, extDelta),
        computed: {
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          computedExtended: computedExt,
          billedExtended: item.extendedAmount,
          difference: extDelta,
        },
      });
    }

    // Duplicate: same description + unit + unit price billed again.
    const dupKey = `${normalizeText(item.description)}|${item.unit}|${item.unitPrice}`;
    if (seen.has(dupKey)) {
      flags.push({
        id: flagId(),
        type: "duplicate",
        severity: item.extendedAmount >= 5000 ? "critical" : "high",
        lineItemId: item.id,
        title: "Duplicate of an earlier line item",
        detail: `Identical to "${item.description}" (${item.quantity} ${item.unit} @ $${item.unitPrice.toFixed(2)}) billed earlier on this change order. Appears charged twice.`,
        exposure: item.extendedAmount,
        computed: {
          firstOccurrence: seen.get(dupKey) ?? "",
          billedExtended: item.extendedAmount,
        },
      });
    } else {
      seen.set(dupKey, item.id);
    }

    // Baseline comparison.
    const base = matchBaseline(item, baseline);
    if (base) {
      const deltaPct = round2(
        ((item.unitPrice - base.unitPrice) / base.unitPrice) * 100,
      );
      if (deltaPct > OVER_BASELINE_TOLERANCE_PCT) {
        const exposure = round2((item.unitPrice - base.unitPrice) * item.quantity);
        const severity: Severity =
          deltaPct >= 20 ? "critical" : deltaPct >= 10 ? "high" : "medium";
        flags.push({
          id: flagId(),
          type: "over_baseline",
          severity,
          lineItemId: item.id,
          title: `Unit price ${deltaPct.toFixed(1)}% over contract`,
          detail: `Contract unit price for "${base.description}" is $${base.unitPrice.toFixed(2)}/${base.unit}; this change order bills $${item.unitPrice.toFixed(2)}/${item.unit}. At ${item.quantity} ${item.unit} that is $${exposure.toFixed(2)} above contract.`,
          exposure,
          computed: {
            baselineUnitPrice: base.unitPrice,
            billedUnitPrice: item.unitPrice,
            deltaPct,
            quantity: item.quantity,
            contractItem: base.description,
          },
        });
      }
    } else {
      // No contract counterpart: either out of stated scope, or a genuinely
      // new item that needs an estimator's pricing review.
      const overlap = [...tokens(item.description)].some((t) =>
        scopeTokens.has(t),
      );
      if (co.statedScope && !overlap) {
        flags.push({
          id: flagId(),
          type: "scope_creep",
          severity: "high",
          lineItemId: item.id,
          title: "Outside the stated scope of this change order",
          detail: `"${item.description}" has no contract unit price and does not relate to the stated scope ("${co.statedScope}"). May belong to base-contract work or another change order.`,
          exposure: item.extendedAmount,
          computed: { billedExtended: item.extendedAmount },
        });
      } else {
        flags.push({
          id: flagId(),
          type: "no_baseline",
          severity: "low",
          lineItemId: item.id,
          title: "No contract price — needs estimator review",
          detail: `"${item.description}" has no matching contract unit price. Not necessarily overbilled, but an estimator should confirm the rate before approval.`,
          exposure: 0,
          computed: { billedExtended: item.extendedAmount },
        });
      }
    }
  }

  // --- Document-level checks -------------------------------------------
  const computedSubtotal = round2(
    co.lineItems.reduce((s, li) => s + li.extendedAmount, 0),
  );
  const statedSubtotal = co.markups.find((m) => m.kind === "subtotal")?.amount;
  const subtotalBase = statedSubtotal ?? computedSubtotal;

  if (statedSubtotal !== undefined && Math.abs(statedSubtotal - computedSubtotal) > MONEY_EPS) {
    flags.push({
      id: flagId(),
      type: "rollup_error",
      severity: "high",
      lineItemId: "",
      title: "Subtotal does not match the sum of line items",
      detail: `Line items sum to $${computedSubtotal.toFixed(2)}, but the stated subtotal is $${statedSubtotal.toFixed(2)}.`,
      exposure: Math.max(0, round2(statedSubtotal - computedSubtotal)),
      computed: { computedSubtotal, statedSubtotal },
    });
  }

  // Excessive overhead & profit vs the contract-allowed rate.
  const op = co.markups.find((m) => m.kind === "overhead_profit");
  if (op?.percent !== undefined && op.percent > baseline.terms.allowedOandPPct) {
    const deltaPts = round2(op.percent - baseline.terms.allowedOandPPct);
    const exposure = round2((subtotalBase * deltaPts) / 100);
    flags.push({
      id: flagId(),
      type: "excessive_markup",
      severity: deltaPts > 5 ? "high" : "medium",
      lineItemId: "",
      title: `Overhead & profit ${op.percent}% exceeds the ${baseline.terms.allowedOandPPct}% allowed`,
      detail: `Contract allows ${baseline.terms.allowedOandPPct}% O&P; this change order applies ${op.percent}%. On a $${subtotalBase.toFixed(2)} base that is $${exposure.toFixed(2)} of excess markup.`,
      exposure,
      computed: {
        allowedPct: baseline.terms.allowedOandPPct,
        billedPct: op.percent,
        base: subtotalBase,
      },
    });
  }

  // Total reconciliation: subtotal + non-subtotal/total markups.
  if (co.statedTotal > 0) {
    const markupSum = round2(
      co.markups
        .filter((m) => m.kind !== "subtotal" && m.kind !== "total")
        .reduce((s, m) => s + m.amount, 0),
    );
    const computedTotal = round2(subtotalBase + markupSum);
    if (Math.abs(co.statedTotal - computedTotal) > MONEY_EPS) {
      flags.push({
        id: flagId(),
        type: "rollup_error",
        severity: "high",
        lineItemId: "",
        title: "Total does not reconcile",
        detail: `Subtotal $${subtotalBase.toFixed(2)} plus markups $${markupSum.toFixed(2)} = $${computedTotal.toFixed(2)}, but the stated total is $${co.statedTotal.toFixed(2)}.`,
        exposure: 0,
        computed: { computedTotal, statedTotal: co.statedTotal },
      });
    }
  }

  flags.sort(
    (a, b) => bySeverity(a.severity) - bySeverity(b.severity) || b.exposure - a.exposure,
  );
  return flags;
}

/** Summary numbers, with exposure de-duplicated per line item. */
export function summarize(co: ChangeOrder, flags: Flag[]): ReviewSummary {
  const billedTotal =
    co.statedTotal > 0
      ? co.statedTotal
      : round2(
          co.lineItems.reduce((s, li) => s + li.extendedAmount, 0) +
            co.markups
              .filter((m) => m.kind !== "subtotal" && m.kind !== "total")
              .reduce((s, m) => s + m.amount, 0),
        );

  // Per line, count only the largest single exposure (no double counting);
  // document-level flags (id "") add on top.
  const perLineMax = new Map<string, number>();
  let docExposure = 0;
  for (const f of flags) {
    if (f.lineItemId === "") {
      docExposure += f.exposure;
    } else {
      perLineMax.set(
        f.lineItemId,
        Math.max(perLineMax.get(f.lineItemId) ?? 0, f.exposure),
      );
    }
  }
  const exposure = round2(
    docExposure + [...perLineMax.values()].reduce((s, v) => s + v, 0),
  );

  return {
    lineItemCount: co.lineItems.length,
    flaggedCount: flags.length,
    billedTotal,
    exposure,
  };
}

/** Top-level convenience: review a change order end to end. */
export function reviewChangeOrder(
  co: ChangeOrder,
  baseline: Baseline,
): ReviewResult {
  const flags = analyzeChangeOrder(co, baseline);
  return { changeOrder: co, flags, summary: summarize(co, flags) };
}
