"use client";

import { useCallback, useRef, useState } from "react";
import type { Flag } from "@/lib/engine";
import { DEMO_BASELINE } from "@/lib/engine";
import { SAMPLE_CHANGE_ORDERS } from "@/lib/samples";
import { analyzePdf, type AnalyzeResult } from "@/lib/analyzeClient";
import { buildDisputeLetter } from "@/lib/disputeLetter";
import { disputedAmount, type Decision } from "@/lib/format";
import { SummaryStrip } from "./SummaryStrip";
import { LineItemTable } from "./LineItemTable";
import { FindingsPanel } from "./FindingsPanel";
import { DisputeSummary } from "./DisputeSummary";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Source = { kind: "sample"; id: string } | { kind: "upload"; name: string };

export function ReviewConsole({
  initialResult,
  initialSampleId,
}: {
  initialResult: AnalyzeResult;
  initialSampleId: string;
}) {
  // Seeded with the server-computed default change order, so a cold visitor
  // sees real numbers on first paint — no "$0.00 / Analyzing…" gap.
  const [result, setResult] = useState<AnalyzeResult | null>(initialResult);
  const [source, setSource] = useState<Source>({ kind: "sample", id: initialSampleId });
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(
    initialResult.flags[0]?.id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (data: ArrayBuffer, src: Source) => {
    setLoading(true);
    setError(null);
    setSource(src);
    setDecisions({});
    setNotes({});
    setDisputeOpen(false);
    try {
      const r = await analyzePdf(data);
      setResult(r);
      setSelectedFlagId(r.flags[0]?.id ?? null);
    } catch {
      setError(
        "Couldn't read line items from this document — its layout isn't machine-readable. Try a sample, or a text-based (non-scanned) change order.",
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSample = useCallback(
    async (id: string) => {
      const res = await fetch(`${BASE_PATH}/samples/${id}.pdf`);
      const data = await res.arrayBuffer();
      await run(data, { kind: "sample", id });
    },
    [run],
  );

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    await run(data, { kind: "upload", name: file.name });
    e.target.value = "";
  };

  const onDecide = (flagId: string, decision: Decision) =>
    setDecisions((prev) => {
      const next = { ...prev };
      if (next[flagId] === decision) delete next[flagId];
      else next[flagId] = decision;
      return next;
    });

  const onNote = (flagId: string, note: string) =>
    setNotes((prev) => ({ ...prev, [flagId]: note }));

  const onSelect = (flag: Flag) => setSelectedFlagId(flag.id);

  const flags = result?.flags ?? [];
  const billed = result?.summary.billedTotal ?? 0;
  const exposure = result?.summary.exposure ?? 0;
  const disputedCount = Object.values(decisions).filter((d) => d === "disputed").length;
  const resolvedCount = flags.filter((f) => decisions[f.id]).length;
  const disputedAmt = disputedAmount(flags, decisions);
  const payable = Math.round((billed - disputedAmt) * 100) / 100;
  const disputedSet = new Set(
    Object.entries(decisions)
      .filter(([, d]) => d === "disputed")
      .map(([id]) => id),
  );
  const co = result?.changeOrder;
  const disputeLetter = co ? buildDisputeLetter(co, flags, decisions, DEMO_BASELINE) : "";

  const provenance =
    result?.extractedBy === "llm"
      ? "Extraction: Claude (Anthropic API), server-side. The deterministic engine computed every flag — the model never invents the numbers."
      : "Extraction: deterministic engine, on-device. Claude-powered extraction (Anthropic API) is wired server-side for messy real-world PDFs — one credit top-up from live.";

  return (
    <main className="mx-auto max-w-[1180px] px-6 py-10 sm:px-10 lg:px-14">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-3.5 w-3.5 rounded-[3px]"
              style={{ background: "var(--color-accent)" }}
            />
            <h1 className="text-[15px] font-semibold tracking-tight">Change Order Review</h1>
          </div>
          <p className="mt-1.5 pl-6 text-[12.5px] text-muted">
            {DEMO_BASELINE.project} · contract {DEMO_BASELINE.contractNumber}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {SAMPLE_CHANGE_ORDERS.map((s) => {
            const active = source.kind === "sample" && source.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => runSample(s.id)}
                title={s.blurb}
                className="rounded-md border px-2.5 py-1.5 text-[12.5px] transition-colors"
                style={
                  active
                    ? { borderColor: "var(--color-accent)", color: "var(--color-accent)" }
                    : { borderColor: "var(--color-line)", color: "var(--color-muted)" }
                }
              >
                {s.number}
              </button>
            );
          })}
          <button
            onClick={() => fileRef.current?.click()}
            className="ml-1 rounded-md px-3 py-1.5 text-[12.5px] text-white transition-colors"
            style={{ background: "var(--color-ink)" }}
          >
            Upload PDF
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={onUpload}
            className="hidden"
          />
        </div>
      </header>

      {loading ? (
        <p className="py-28 text-center text-[13px] text-muted">Analyzing change order…</p>
      ) : error ? (
        <p className="mx-auto max-w-md py-28 text-center text-[13px] leading-relaxed text-muted">
          {error}
        </p>
      ) : co ? (
        <>
          {/* CO identity */}
          <div className="mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[20px] font-medium tracking-tight">
              {co.number} <span className="text-faint">·</span>{" "}
              <span className="font-normal">{co.title}</span>
            </h2>
            <span className="text-[11px] uppercase tracking-wide text-faint">
              {source.kind === "sample" ? "sample" : `uploaded · ${source.name}`}
            </span>
          </div>

          {/* Summary */}
          <div className="mt-6 border-t border-line pt-6">
            <SummaryStrip
              billed={billed}
              exposure={exposure}
              findings={flags.length}
              disputedCount={disputedCount}
              disputedAmt={disputedAmt}
              payable={payable}
            />
            <p className="mt-5 max-w-3xl text-[12px] leading-relaxed text-faint">{provenance}</p>
          </div>

          {/* Body */}
          <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-10 border-t border-line pt-8 lg:grid-cols-[1fr_360px]">
            <section className="min-w-0">
              <LineItemTable
                changeOrder={co}
                flags={flags}
                selectedFlagId={selectedFlagId}
                disputed={disputedSet}
                onSelect={onSelect}
              />
            </section>
            <aside className="lg:border-l lg:border-line lg:pl-10">
              <div className="mb-4 flex items-baseline justify-between">
                <h3 className="text-[11px] uppercase tracking-wide text-faint">Estimator review</h3>
                <span className="tnum text-[11px] text-faint">
                  {resolvedCount}/{flags.length} resolved
                </span>
              </div>
              <FindingsPanel
                flags={flags}
                decisions={decisions}
                notes={notes}
                selectedFlagId={selectedFlagId}
                disputedCount={disputedCount}
                onSelect={onSelect}
                onDecide={onDecide}
                onNote={onNote}
                onGenerateDispute={() => setDisputeOpen(true)}
              />
            </aside>
          </div>
        </>
      ) : null}

      <DisputeSummary open={disputeOpen} letter={disputeLetter} onClose={() => setDisputeOpen(false)} />
    </main>
  );
}
