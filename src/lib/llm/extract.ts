import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ChangeOrder, Flag } from "@/lib/engine";

/**
 * Server-side LLM extraction.
 *
 * Claude reads the raw text of a change-order PDF (any layout) and returns the
 * line items, markups, scope, and total as clean structured data. This is the
 * fuzzy, real-world-messy half of the problem — the half LLMs are good at.
 *
 * The money math (baseline comparison, overbill flagging) is then done by the
 * deterministic engine, NOT the LLM — a financial review tool must not have
 * hallucinated dollar deltas. Claude extracts; the engine computes; a human
 * estimator signs off.
 *
 * The API key is read from the server environment and never leaves the server.
 */

const MODEL = "claude-opus-4-8";

const CHANGE_ORDER_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    number: { type: "string", description: "Change order number, e.g. CO-04" },
    title: { type: "string" },
    statedScope: {
      type: "string",
      description: "The work the change order claims to cover, in the GC's own words.",
    },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", description: "Unit of measure: EA, LF, SF, CY, LB, HR, DAY, LS" },
          unitPrice: { type: "number" },
          extendedAmount: { type: "number", description: "Amount as billed (qty x unit price per the document)" },
          category: { type: "string", enum: ["labor", "material", "equipment", "subcontractor", "other"] },
        },
        required: ["description", "quantity", "unit", "unitPrice", "extendedAmount", "category"],
      },
    },
    markups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["subtotal", "overhead_profit", "tax", "bond", "total"] },
          label: { type: "string" },
          percent: {
            anyOf: [{ type: "number" }, { type: "null" }],
            description: "Stated percentage if expressed as one, else null",
          },
          amount: { type: "number" },
        },
        required: ["kind", "label", "percent", "amount"],
      },
    },
    statedTotal: { type: "number" },
  },
  required: ["number", "title", "statedScope", "lineItems", "markups", "statedTotal"],
};

const EXTRACTION_SYSTEM = `You extract structured data from construction change-order documents.

Return EVERY billed line item exactly as it appears on the document — transcribe the description, quantity, unit of measure, unit price, and extended (line-total) amount verbatim. Do not correct math, drop duplicate rows, merge rows, or invent items: a downstream engine relies on the raw billed numbers to detect errors and duplicates, so faithful transcription matters more than tidiness.

For markup/rollup lines (Subtotal, Overhead & Profit / O&P, Tax, Bond, Total) record the label, the stated percentage if one is shown, and the amount. Capture the bottom-line total in statedTotal.

If a field is genuinely absent, use an empty string for text or 0 for numbers; use null for a markup percent that isn't stated.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in LLM response");
  return JSON.parse(body.slice(start, end + 1));
}

/** Extract a structured change order from raw PDF text using Claude. */
export async function extractChangeOrderLLM(
  rawText: string,
  apiKey: string,
): Promise<ChangeOrder> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: CHANGE_ORDER_SCHEMA },
    },
    system: EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract the change order from this document text:\n\n${rawText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("LLM returned no text content");
  }
  const raw = extractJson(textBlock.text) as ChangeOrder;

  // Re-id line items deterministically so the engine's ids are stable.
  return {
    ...raw,
    lineItems: raw.lineItems.map((li, i) => ({ ...li, id: `li-${i}` })),
  };
}

/**
 * A short, plain-English estimator note over the computed flags.
 * This is the LLM-assisted-analysis layer that sits on top of the deterministic
 * findings — it summarises, it does not compute the numbers.
 */
export async function summarizeReviewLLM(
  co: ChangeOrder,
  flags: Flag[],
  exposure: number,
  apiKey: string,
): Promise<string> {
  if (flags.length === 0) {
    return "No issues detected against the contract baseline. Recommend approval pending the usual documentation check.";
  }
  const client = new Anthropic({ apiKey });
  const findings = flags
    .map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`)
    .join("\n");
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    output_config: { effort: "low" },
    system:
      "You are a senior construction estimator writing a 2-3 sentence note to a building owner about a change order under review. Plain, direct, no preamble, no bullet points. Reference the dollars at issue and what the owner should do (approve, dispute specific lines, ask the GC for backup). Do not invent numbers beyond those given.",
    messages: [
      {
        role: "user",
        content: `Change order ${co.number} ("${co.title}"), billed total $${co.statedTotal.toFixed(2)}. The review engine put $${exposure.toFixed(2)} at issue across these findings:\n${findings}\n\nWrite the estimator note.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text"
    ? textBlock.text.trim()
    : "";
}
