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

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export interface AnalyzeResult {
  changeOrder: ChangeOrder;
  flags: Flag[];
  summary: ReviewSummary;
  /** Optional LLM-written estimator note (server path only); not rendered. */
  llmSummary: string;
  extractedBy: "llm" | "on-device";
}

/** Thrown when a document yields no parseable line items. */
export class NoLineItemsError extends Error {
  constructor() {
    super("no_line_items");
    this.name = "NoLineItemsError";
  }
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
      if (!j.changeOrder?.lineItems?.length) throw new NoLineItemsError();
      return { ...j, extractedBy: "llm" };
    }
  } catch (e) {
    if (e instanceof NoLineItemsError) throw e;
    /* otherwise fall through to on-device */
  }

  const co = parseChangeOrder(rawText);
  // Never "recommend approval" on a document we failed to parse — that would
  // contradict the whole point of the tool. Surface an honest read-failure.
  if (co.lineItems.length === 0) throw new NoLineItemsError();

  const flags = analyzeChangeOrder(co, DEMO_BASELINE);
  const summaryStats = summarize(co, flags);
  return {
    changeOrder: co,
    flags,
    summary: summaryStats,
    llmSummary: "",
    extractedBy: "on-device",
  };
}
