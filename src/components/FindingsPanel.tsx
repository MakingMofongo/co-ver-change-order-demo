"use client";

import type { Flag } from "@/lib/engine";
import { money, severityColor, type Decision } from "@/lib/format";

function DecisionButton({
  active,
  color,
  children,
  onClick,
}: {
  active: boolean;
  color: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border px-3 py-1.5 text-[12.5px] transition-colors"
      style={
        active
          ? { background: color, borderColor: color, color: "white" }
          : { borderColor: "var(--color-line)", color: "var(--color-muted)" }
      }
    >
      {children}
    </button>
  );
}

export function FindingsPanel({
  flags,
  decisions,
  selectedFlagId,
  llmSummary,
  extractedBy,
  onSelect,
  onDecide,
}: {
  flags: Flag[];
  decisions: Record<string, Decision>;
  selectedFlagId: string | null;
  llmSummary: string;
  extractedBy: "llm" | "on-device";
  onSelect: (flag: Flag) => void;
  onDecide: (flagId: string, decision: Decision) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {llmSummary && (
        <p className="text-[13px] leading-relaxed text-muted">
          {llmSummary}
          <span className="mt-1.5 block text-[11px] text-faint">
            {extractedBy === "llm"
              ? "Extracted by Claude · checked against the contract baseline"
              : "On-device extraction · checked against the contract baseline"}
          </span>
        </p>
      )}

      {flags.length === 0 ? (
        <p className="text-[13px] text-muted">No findings.</p>
      ) : (
        <ul className="flex flex-col">
          {flags.map((f) => {
            const selected = f.id === selectedFlagId;
            const decision = decisions[f.id];
            return (
              <li key={f.id} className="border-t border-line first:border-t-0">
                <button
                  onClick={() => onSelect(f)}
                  className="flex w-full items-start gap-2.5 py-3 text-left"
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: severityColor[f.severity] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        decision === "disputed"
                          ? "text-[13.5px] text-muted"
                          : "text-[13.5px] text-ink"
                      }
                    >
                      {f.title}
                    </span>
                  </span>
                  {f.exposure > 0 && (
                    <span className="tnum shrink-0 pt-0.5 text-[12.5px] text-muted">
                      {money(f.exposure)}
                    </span>
                  )}
                </button>

                {selected && (
                  <div className="fadein pb-4 pl-[18px]">
                    <p className="mb-3 text-[13px] leading-relaxed text-muted">{f.detail}</p>
                    <div className="flex items-center gap-2">
                      <DecisionButton
                        active={decision === "disputed"}
                        color="var(--color-sev-critical)"
                        onClick={() => onDecide(f.id, "disputed")}
                      >
                        Dispute
                      </DecisionButton>
                      <DecisionButton
                        active={decision === "approved"}
                        color="var(--color-ok)"
                        onClick={() => onDecide(f.id, "approved")}
                      >
                        Approve
                      </DecisionButton>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
