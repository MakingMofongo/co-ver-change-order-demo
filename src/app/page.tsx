import {
  DEMO_BASELINE,
  parseChangeOrder,
  analyzeChangeOrder,
  summarize,
} from "@/lib/engine";
import { getSample, renderChangeOrderText } from "@/lib/samples";
import { ReviewConsole } from "@/components/ReviewConsole";
import type { AnalyzeResult } from "@/lib/analyzeClient";

const DEFAULT_SAMPLE_ID = "co-04";

/**
 * Compute the default change order's review at build time so the static HTML
 * ships with real numbers — a cold visitor sees the strongest example (CO-04)
 * immediately, with no "$0.00 / Analyzing…" gap. This matches exactly what the
 * client computes from the same PDF (verified: same flags, same exposure).
 */
function buildInitialResult(): AnalyzeResult {
  const co = parseChangeOrder(renderChangeOrderText(getSample(DEFAULT_SAMPLE_ID)!));
  const flags = analyzeChangeOrder(co, DEMO_BASELINE);
  const summary = summarize(co, flags);
  return { changeOrder: co, flags, summary, llmSummary: "", extractedBy: "on-device" };
}

export default function Page() {
  return (
    <ReviewConsole initialResult={buildInitialResult()} initialSampleId={DEFAULT_SAMPLE_ID} />
  );
}
