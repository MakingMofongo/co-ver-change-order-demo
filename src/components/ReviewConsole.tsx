"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Flag } from "@/lib/engine";
import { DEMO_BASELINE } from "@/lib/engine";
import { SAMPLE_CHANGE_ORDERS } from "@/lib/samples";
import { analyzePdf, type AnalyzeResult } from "@/lib/analyzeClient";
import { disputedAmount, type Decision } from "@/lib/format";
import { SummaryStrip } from "./SummaryStrip";
import { LineItemTable } from "./LineItemTable";
import { FindingsPanel } from "./FindingsPanel";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Source = { kind: "sample"; id: string } | { kind: "upload"; name: string };

export function ReviewConsole() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [source, setSource] = useState<Source>({ kind: "sample", id: "co-04" });
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (data: ArrayBuffer, src: Source) => {
    setLoading(true);
    setError(null);
    setSource(src);
    try {
      const r = await analyzePdf(data);
      setResult(r);
      setDecisions({});
      setSelectedFlagId(r.flags[0]?.id ?? null);
    } catch {
      setError("Couldn't read line items from this document. Try a sample.");
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

  useEffect(() => {
    runSample("co-04");
  }, [runSample]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    await run(data, { kind: "upload", name: file.name });
    e.target.value = "";
  };

  const onDecide = (flagId: string, decision: Decision) => {
    setDecisions((prev) => {
      const next = { ...prev };
      if (next[flagId] === decision) delete next[flagId];
      else next[flagId] = decision;
      return next;
    });
  };

  const onSelect = (flag: Flag) => setSelectedFlagId(flag.id);

  const flags = result?.flags ?? [];
  const billed = result?.summary.billedTotal ?? 0;
  const exposure = result?.summary.exposure ?? 0;
  const disputedCount = Object.values(decisions).filter((d) => d === "disputed").length;
  const disputedAmt = disputedAmount(flags, decisions);
  const payable = Math.round((billed - disputedAmt) * 100) / 100;
  const disputedSet = new Set(
    Object.entries(decisions)
      .filter(([, d]) => d === "disputed")
      .map(([id]) => id),
  );

  const co = result?.changeOrder;
  const activeSampleNumber =
    source.kind === "sample"
      ? SAMPLE_CHANGE_ORDERS.find((s) => s.id === source.id)?.number
      : null;

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

      {/* CO identity + source */}
      <div className="mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {co && (
          <>
            <h2 className="text-[20px] font-medium tracking-tight">
              {co.number} <span className="text-faint">·</span>{" "}
              <span className="font-normal">{co.title}</span>
            </h2>
            <span className="text-[11px] uppercase tracking-wide text-faint">
              {source.kind === "sample"
                ? `sample ${activeSampleNumber ?? ""}`.trim()
                : `uploaded · ${source.name}`}
            </span>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="mt-6 border-y border-line py-6">
        <SummaryStrip
          billed={billed}
          exposure={exposure}
          findings={flags.length}
          disputedCount={disputedCount}
          disputedAmt={disputedAmt}
          payable={payable}
        />
      </div>

      {/* Body */}
      {loading ? (
        <p className="py-24 text-center text-[13px] text-muted">
          Analyzing change order…
        </p>
      ) : error ? (
        <p className="py-24 text-center text-[13px] text-muted">{error}</p>
      ) : co ? (
        <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[1fr_360px]">
          <section className="fadein min-w-0">
            <LineItemTable
              changeOrder={co}
              flags={flags}
              selectedFlagId={selectedFlagId}
              disputed={disputedSet}
              onSelect={onSelect}
            />
          </section>
          <aside className="fadein lg:border-l lg:border-line lg:pl-10">
            <h3 className="mb-4 text-[11px] uppercase tracking-wide text-faint">
              Findings
            </h3>
            <FindingsPanel
              flags={flags}
              decisions={decisions}
              selectedFlagId={selectedFlagId}
              llmSummary={result?.llmSummary ?? ""}
              extractedBy={result?.extractedBy ?? "on-device"}
              onSelect={onSelect}
              onDecide={onDecide}
            />
          </aside>
        </div>
      ) : null}
    </main>
  );
}
