import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  DEMO_BASELINE,
  parseChangeOrder,
  analyzeChangeOrder,
  summarize,
} from "../src/lib/engine";

const here = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(here, "..", "public", "samples");

interface TextItemLike {
  str: string;
  transform: number[];
}

async function pdfToText(path: string): Promise<string> {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as TextItemLike[];
    const rows: { y: number; items: { x: number; str: string }[] }[] = [];
    for (const it of items) {
      if (typeof it.str !== "string") continue;
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 3);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, str: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const text = row.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) lines.push(text);
    }
  }
  return lines.join("\n");
}

const EXPECT: Record<string, { items: number; flagTypes: string[] }> = {
  "co-04": {
    items: 7,
    flagTypes: ["over_baseline", "over_baseline", "duplicate", "math_error", "scope_creep", "excessive_markup"],
  },
  "co-07": { items: 3, flagTypes: ["over_baseline"] },
  "co-11": { items: 4, flagTypes: ["no_baseline", "rollup_error"] },
};

async function main() {
  let ok = true;
  for (const id of ["co-04", "co-07", "co-11"]) {
    const text = await pdfToText(join(samplesDir, `${id}.pdf`));
    const co = parseChangeOrder(text);
    const flags = analyzeChangeOrder(co, DEMO_BASELINE);
    const s = summarize(co, flags);
    const types = flags.map((f) => f.type).sort();
    const exp = EXPECT[id];
    const expTypes = [...exp.flagTypes].sort();
    const itemsOk = co.lineItems.length === exp.items;
    const typesOk = JSON.stringify(types) === JSON.stringify(expTypes);
    if (!itemsOk || !typesOk) ok = false;
    console.log(
      `\n${id}: ${co.number} "${co.title}"  items=${co.lineItems.length}/${exp.items} ${itemsOk ? "OK" : "MISMATCH"}`,
    );
    console.log(`  flags: ${flags.map((f) => `${f.type}(${f.severity})`).join(", ")}`);
    console.log(`  types ${typesOk ? "OK" : "MISMATCH expected " + expTypes.join(",")}`);
    console.log(`  billed=$${s.billedTotal.toFixed(2)} atIssue=$${s.exposure.toFixed(2)}`);
  }
  console.log(`\n=== ${ok ? "ALL PIPELINES OK (real PDF -> pdfjs -> engine)" : "FAILURES"} ===`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
