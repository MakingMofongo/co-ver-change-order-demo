import {
  DEMO_BASELINE,
  parseChangeOrder,
  analyzeChangeOrder,
  summarize,
  type ChangeOrder,
  type Flag,
  type ReviewSummary,
} from "@/lib/engine";
import { extractTextFromPdf } from "@/lib/pdf/extractText";
import { money } from "@/lib/format";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export interface AnalyzeResult {
  changeOrder: ChangeOrder;
  flags: Flag[];
  summary: ReviewSummary;
  llmSummary: string;
  extractedBy: "llm" | "on-device";
}

function deterministicNote(co: ChangeOrder, flags: Flag[], exposure: number): string {
  if (flags.length === 0) {
    return "No issues detected against the contract baseline. Recommend approval pending the usual documentation check.";
  }
  const critical = flags.filter((f) => f.severity === "critical").length;
  const lead = critical
    ? `${critical} line${critical > 1 ? "s" : ""} bill well over the contract. `
    : "";
  return `${lead}${money(exposure)} is at issue across ${flags.length} finding${flags.length > 1 ? "s" : ""} on this ${money(co.statedTotal)} change order. Review each finding and dispute the lines that aren't supported before releasing payment.`;
}

/** Run a change-order PDF through the full pipeline. */
export async function analyzePdf(data: ArrayBuffer): Promise<AnalyzeResult> {
  const rawText = await extractTextFromPdf(data);

  // Prefer the live server route (Claude extraction). Falls back silently to the
  // on-device deterministic engine when no server is present (static build).
  try {
    const res = await fetch(`${BASE_PATH}/api/analyze/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    if (res.ok) {
      const j = (await res.json()) as Omit<AnalyzeResult, "extractedBy">;
      return { ...j, extractedBy: "llm" };
    }
  } catch {
    /* fall through to on-device */
  }

  const co = parseChangeOrder(rawText);
  const flags = analyzeChangeOrder(co, DEMO_BASELINE);
  const summaryStats = summarize(co, flags);
  return {
    changeOrder: co,
    flags,
    summary: summaryStats,
    llmSummary: deterministicNote(co, flags, summaryStats.exposure),
    extractedBy: "on-device",
  };
}
