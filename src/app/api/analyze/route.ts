import { NextResponse } from "next/server";
import { DEMO_BASELINE, analyzeChangeOrder, summarize } from "@/lib/engine";
import { extractChangeOrderLLM, summarizeReviewLLM } from "@/lib/llm/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analyze
 * Body: { rawText: string }
 *
 * 1. Claude extracts the structured change order from the raw PDF text.
 * 2. The deterministic engine computes the overbilling flags (auditable math).
 * 3. Claude writes a short estimator note over those findings.
 *
 * The API key lives only in the server environment.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "no_llm", message: "Server has no ANTHROPIC_API_KEY configured." },
      { status: 503 },
    );
  }

  let rawText: string;
  try {
    const body = (await request.json()) as { rawText?: string };
    rawText = (body.rawText ?? "").trim();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (rawText.length < 20) {
    return NextResponse.json(
      { error: "empty", message: "No extractable text in the document." },
      { status: 422 },
    );
  }

  try {
    const changeOrder = await extractChangeOrderLLM(rawText, apiKey);
    if (changeOrder.lineItems.length === 0) {
      return NextResponse.json(
        { error: "no_items", message: "No line items found in the document." },
        { status: 422 },
      );
    }
    const flags = analyzeChangeOrder(changeOrder, DEMO_BASELINE);
    const summaryStats = summarize(changeOrder, flags);
    const llmSummary = await summarizeReviewLLM(
      changeOrder,
      flags,
      summaryStats.exposure,
      apiKey,
    ).catch(() => "");

    return NextResponse.json({
      changeOrder,
      flags,
      summary: summaryStats,
      llmSummary,
      extractedBy: "llm",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "extraction failed";
    return NextResponse.json({ error: "llm_failed", message }, { status: 502 });
  }
}
