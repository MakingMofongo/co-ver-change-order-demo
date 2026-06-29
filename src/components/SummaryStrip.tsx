"use client";

import { money } from "@/lib/format";

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-faint">{label}</span>
      <span
        className="tnum text-[19px] leading-none"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function SummaryStrip({
  billed,
  exposure,
  findings,
  disputedCount,
  disputedAmt,
  payable,
}: {
  billed: number;
  exposure: number;
  findings: number;
  disputedCount: number;
  disputedAmt: number;
  payable: number;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
      <Metric label="Billed" value={money(billed)} />
      <Metric
        label="At issue"
        value={money(exposure)}
        accent={exposure > 0 ? "var(--color-sev-high)" : undefined}
      />
      <Metric label="Findings" value={String(findings)} />
      <Metric
        label="Disputed"
        value={disputedCount === 0 ? "—" : `${money(disputedAmt)} · ${disputedCount}`}
      />
      <Metric
        label="Adjusted payable"
        value={money(payable)}
        accent={disputedCount > 0 ? "var(--color-ok)" : undefined}
      />
    </div>
  );
}
