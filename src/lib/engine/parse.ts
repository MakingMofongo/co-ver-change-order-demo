import type {
  ChangeOrder,
  LineCategory,
  LineItem,
  MarkupLine,
} from "./types";

/** Parse a money token like "$11,520.00" or "1850" into a number. */
export function parseMoney(token: string): number {
  const n = Number(token.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * A line-item row, after column whitespace is collapsed, looks like:
 *   "<description...> <qty> <unit> $<unitPrice> $<extended>"
 * We anchor on the tail (qty, short unit, two money columns) and let the
 * description absorb everything before it — so descriptions that contain
 * numbers ("#12 THHN", "2x4 LED troffer") still parse correctly.
 */
const ROW_RE =
  /^(.*?\S)\s+([\d,]+(?:\.\d+)?)\s+([A-Za-z]{1,4})\s+\$?([\d,]+(?:\.\d{1,2})?)\s+\$?(-?[\d,]+(?:\.\d{1,2})?)$/;

const MARKUP_KEYWORDS: { re: RegExp; kind: MarkupLine["kind"]; label: string }[] =
  [
    { re: /^sub\s*total\b/i, kind: "subtotal", label: "Subtotal" },
    {
      re: /^(overhead|o\s*&\s*p|o\/?p|overhead\s*&?\s*profit|profit|markup)\b/i,
      kind: "overhead_profit",
      label: "Overhead & Profit",
    },
    { re: /^(sales\s*)?tax\b/i, kind: "tax", label: "Tax" },
    { re: /^bond\b/i, kind: "bond", label: "Bond" },
    {
      re: /^(change\s*order\s*)?(grand\s*)?total\b/i,
      kind: "total",
      label: "Total",
    },
  ];

function inferCategory(description: string, unit: string): LineCategory {
  const d = description.toLowerCase();
  const u = unit.toUpperCase();
  if (u === "HR" || /\b(electrician|laborer|labor|foreman|journeyman|carpenter|operator)\b/.test(d))
    return "labor";
  if (u === "DAY" || /\b(rental|rent|lift|crane|equipment|excavator)\b/.test(d))
    return "equipment";
  if (/\b(subcontractor|sub-contractor|\bsub\b)\b/.test(d)) return "subcontractor";
  return "material";
}

function extractTrailingMoney(line: string): number | null {
  const m = line.match(/\$?(-?[\d,]+(?:\.\d{1,2})?)\s*$/);
  return m ? parseMoney(m[1]) : null;
}

function extractPercent(line: string): number | undefined {
  const m = line.match(/\(\s*([\d.]+)\s*%\s*\)/);
  return m ? Number(m[1]) : undefined;
}

/**
 * Parse the reconstructed text of a change order into structured data.
 *
 * Pure and deterministic: feed it a different document, get different items.
 * The text is expected to be one logical row per line (the PDF extractor groups
 * text by vertical position to produce exactly that).
 */
export function parseChangeOrder(rawText: string): ChangeOrder {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  let number = "";
  let title = "";
  let statedScope = "";
  const lineItems: LineItem[] = [];
  const markups: MarkupLine[] = [];
  let statedTotal = 0;
  let idx = 0;

  for (const line of lines) {
    // Header fields.
    if (!number) {
      const m = line.match(/\b(CO[-\s]?\d+|change\s*order\s*(?:no\.?|#)?\s*\d+)/i);
      if (m) number = m[1].toUpperCase().replace(/\s+/g, "-").replace("CHANGE-ORDER", "CO");
    }
    if (!title) {
      const m = line.match(/^title\s*[:\-]\s*(.+)$/i);
      if (m) {
        title = m[1].trim();
        continue;
      }
    }
    if (!statedScope) {
      const m = line.match(/^scope\s*[:\-]\s*(.+)$/i);
      if (m) {
        statedScope = m[1].trim();
        continue;
      }
    }

    // Markup / rollup lines (checked before line items so "Subtotal $X" isn't
    // mis-read as an item).
    const markup = MARKUP_KEYWORDS.find((k) => k.re.test(line));
    if (markup) {
      const amount = extractTrailingMoney(line);
      if (amount !== null) {
        const percent = extractPercent(line);
        markups.push({ kind: markup.kind, label: markup.label, percent, amount });
        if (markup.kind === "total") statedTotal = amount;
        continue;
      }
    }

    // Line items.
    const row = line.match(ROW_RE);
    if (row) {
      const [, description, qtyTok, unitTok, upTok, extTok] = row;
      const quantity = parseMoney(qtyTok);
      const unitPrice = parseMoney(upTok);
      const extendedAmount = parseMoney(extTok);
      if (
        Number.isFinite(quantity) &&
        Number.isFinite(unitPrice) &&
        Number.isFinite(extendedAmount)
      ) {
        const unit = unitTok.toUpperCase();
        lineItems.push({
          id: `li-${idx++}`,
          description: description.trim(),
          quantity,
          unit,
          unitPrice,
          extendedAmount,
          category: inferCategory(description, unit),
        });
      }
    }
  }

  // Fallbacks so a document still reviews even if a header label is missing.
  if (!title) {
    const t = lines.find((l) => /^title\b/i.test(l));
    title = t ? t.replace(/^title\s*[:\-]?\s*/i, "") : number || "Change Order";
  }
  if (!number) number = "CO-NA";

  return { number, title, statedScope, lineItems, markups, statedTotal };
}
