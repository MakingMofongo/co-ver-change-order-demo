import type { Flag, Severity } from "@/lib/engine";

export function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function num(n: number): string {
  return n.toLocaleString("en-US");
}

export const severityColor: Record<Severity, string> = {
  critical: "var(--color-sev-critical)",
  high: "var(--color-sev-high)",
  medium: "var(--color-sev-medium)",
  low: "var(--color-sev-low)",
};

const FLAG_LABELS: Record<string, string> = {
  over_baseline: "over contract",
  duplicate: "duplicate",
  math_error: "math error",
  rollup_error: "doesn't reconcile",
  excessive_markup: "excess markup",
  scope_creep: "out of scope",
  no_baseline: "needs pricing",
};

export function flagLabel(type: string): string {
  return FLAG_LABELS[type] ?? type;
}

export type Decision = "approved" | "disputed";

/** Dollars currently disputed, de-duplicated per line item (+ document-level). */
export function disputedAmount(
  flags: Flag[],
  decisions: Record<string, Decision>,
): number {
  const perLine = new Map<string, number>();
  let doc = 0;
  for (const f of flags) {
    if (decisions[f.id] !== "disputed") continue;
    if (f.lineItemId === "") doc += f.exposure;
    else perLine.set(f.lineItemId, Math.max(perLine.get(f.lineItemId) ?? 0, f.exposure));
  }
  const sum = doc + [...perLine.values()].reduce((s, v) => s + v, 0);
  return Math.round(sum * 100) / 100;
}
