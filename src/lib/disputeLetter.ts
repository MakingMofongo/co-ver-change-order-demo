import type { Baseline, ChangeOrder, Flag } from "@/lib/engine";
import { disputedAmount, money, type Decision } from "@/lib/format";

/**
 * Compose a plain dispute summary/letter to the GC from the findings the
 * estimator has actually disputed. Nothing is canned — the line items, reasons,
 * and totals are read straight from the disputed flags + the change order.
 *
 * Returns "" when nothing is disputed.
 */
export function buildDisputeLetter(
  co: ChangeOrder,
  flags: Flag[],
  decisions: Record<string, Decision>,
  baseline: Baseline,
): string {
  const disputed = flags.filter((f) => decisions[f.id] === "disputed");
  if (disputed.length === 0) return "";

  const descOf = (f: Flag): string => {
    if (!f.lineItemId) return f.title;
    const li = co.lineItems.find((l) => l.id === f.lineItemId);
    return li ? li.description : f.title;
  };

  const items = disputed.map((f, i) => {
    const amount = f.exposure > 0 ? `  (${money(f.exposure)})` : "";
    return `${i + 1}. ${descOf(f)} — ${f.detail}${amount}`;
  });

  const total = disputedAmount(flags, decisions);
  const billed = co.statedTotal;
  const pct = billed > 0 ? Math.round((total / billed) * 100) : 0;

  return [
    `RE: Change Order ${co.number} — ${co.title}`,
    `Project: ${baseline.project} (Contract ${baseline.contractNumber})`,
    ``,
    `We have reviewed this change order against the contract and dispute the following ${disputed.length} item${disputed.length > 1 ? "s" : ""} pending supporting documentation:`,
    ``,
    items.join("\n\n"),
    ``,
    `Total disputed: ${money(total)} of ${money(billed)} billed${pct > 0 ? ` (${pct}%)` : ""}.`,
    ``,
    `Please provide backup for the items above or revise the change order accordingly.`,
  ].join("\n");
}
