"use client";

import { useState } from "react";

export function DisputeSummary({
  open,
  letter,
  onClose,
}: {
  open: boolean;
  letter: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard may be unavailable; the text is selectable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.2_0.01_255/0.28)] p-6"
      onClick={onClose}
    >
      <div
        className="fadein w-full max-w-[640px] rounded-xl bg-surface p-8 shadow-[0_12px_48px_oklch(0.2_0.02_255/0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-baseline justify-between">
          <h3 className="text-[13px] font-medium tracking-tight">Dispute summary</h3>
          <span className="text-[11px] uppercase tracking-wide text-faint">to the GC</span>
        </div>
        <pre className="tnum max-h-[52vh] overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink">
          {letter}
        </pre>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-[12.5px] text-muted"
            style={{ borderColor: "var(--color-line)" }}
          >
            Close
          </button>
          <button
            onClick={copy}
            className="rounded-md px-3 py-1.5 text-[12.5px] text-white"
            style={{ background: "var(--color-ink)" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
