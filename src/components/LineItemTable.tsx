"use client";

import type { ChangeOrder, Flag } from "@/lib/engine";
import { money, num, severityColor, flagLabel } from "@/lib/format";

const sevRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;

function topFlagByLine(flags: Flag[]): Map<string, Flag> {
  const m = new Map<string, Flag>();
  for (const f of flags) {
    if (!f.lineItemId) continue;
    const cur = m.get(f.lineItemId);
    if (!cur || sevRank[f.severity] < sevRank[cur.severity]) m.set(f.lineItemId, f);
  }
  return m;
}

export function LineItemTable({
  changeOrder,
  flags,
  selectedFlagId,
  disputed,
  onSelect,
}: {
  changeOrder: ChangeOrder;
  flags: Flag[];
  selectedFlagId: string | null;
  disputed: Set<string>;
  onSelect: (flag: Flag) => void;
}) {
  const byLine = topFlagByLine(flags);

  return (
    <div>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
            <th className="w-5 py-2" />
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 pr-3 text-right font-medium">Qty</th>
            <th className="py-2 pr-3 font-medium">Unit</th>
            <th className="py-2 pr-3 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {changeOrder.lineItems.map((li) => {
            const flag = byLine.get(li.id);
            const isSelected = flag && flag.id === selectedFlagId;
            const isDisputed = flag && disputed.has(flag.id);
            return (
              <tr
                key={li.id}
                onClick={flag ? () => onSelect(flag) : undefined}
                className={[
                  "border-t border-line align-top transition-colors",
                  flag ? "cursor-pointer hover:bg-bg" : "",
                  isSelected ? "bg-[oklch(0.52_0.12_245/0.06)]" : "",
                ].join(" ")}
              >
                <td className="py-2.5 pl-0.5">
                  {flag && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: severityColor[flag.severity] }}
                      aria-label={flag.severity}
                    />
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <span className={isDisputed ? "text-muted line-through" : "text-ink"}>
                    {li.description}
                  </span>
                  {flag && (
                    <span className="ml-2 text-[12px] text-muted">{flagLabel(flag.type)}</span>
                  )}
                </td>
                <td className="tnum py-2.5 pr-3 text-right text-muted">{num(li.quantity)}</td>
                <td className="py-2.5 pr-3 text-faint">{li.unit}</td>
                <td className="tnum py-2.5 pr-3 text-right text-muted">{money(li.unitPrice)}</td>
                <td className="tnum py-2.5 text-right text-ink">{money(li.extendedAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        {changeOrder.markups.length > 0 && (
          <tfoot className="text-[13px] text-muted">
            {changeOrder.markups.map((m, i) => (
              <tr key={i} className={i === 0 ? "border-t-2 border-line" : ""}>
                <td />
                <td className="py-1.5" colSpan={4}>
                  {m.label}
                  {m.percent != null ? ` (${m.percent}%)` : ""}
                </td>
                <td className="tnum py-1.5 text-right">{money(m.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-line text-ink">
              <td />
              <td className="py-2 font-medium" colSpan={4}>
                Change order total
              </td>
              <td className="tnum py-2 text-right font-medium">{money(changeOrder.statedTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
