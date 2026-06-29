import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { SAMPLE_CHANGE_ORDERS, type SampleChangeOrder } from "../src/lib/samples";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "samples");

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Column geometry (Letter page). Right-aligned numeric columns.
const X_DESC = 54;
const X_QTY_RIGHT = 372;
const X_UNIT = 388;
const X_UP_RIGHT = 482;
const X_AMT_RIGHT = 558;

async function buildPdf(co: SampleChangeOrder): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.14, 0.15, 0.17);
  const muted = rgb(0.42, 0.43, 0.46);

  let y = 748;
  const line = (
    text: string,
    x: number,
    size: number,
    f = font,
    color = ink,
  ) => page.drawText(text, { x, y, size, font: f, color });
  const right = (text: string, xRight: number, size: number, f = font, color = ink) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: xRight - w, y, size, font: f, color });
  };

  line(`CHANGE ORDER ${co.number}`, X_DESC, 15, bold);
  y -= 20;
  line(`Project: ${co.project}`, X_DESC, 9.5, font, muted);
  y -= 14;
  line(`Title: ${co.title}`, X_DESC, 9.5, font, muted);
  y -= 14;
  line(`Date: ${co.date}`, X_DESC, 9.5, font, muted);
  y -= 14;
  line(`Scope: ${co.scope}`, X_DESC, 8, font, muted); // kept to one physical line
  y -= 26;

  // Column header
  line("DESCRIPTION", X_DESC, 8, bold, muted);
  right("QTY", X_QTY_RIGHT, 8, bold, muted);
  line("UNIT", X_UNIT, 8, bold, muted);
  right("UNIT PRICE", X_UP_RIGHT, 8, bold, muted);
  right("AMOUNT", X_AMT_RIGHT, 8, bold, muted);
  y -= 6;
  page.drawLine({
    start: { x: X_DESC, y },
    end: { x: X_AMT_RIGHT, y },
    thickness: 0.6,
    color: rgb(0.85, 0.86, 0.88),
  });
  y -= 16;

  for (const r of co.rows) {
    line(r.description, X_DESC, 10, font, ink);
    right(String(r.quantity), X_QTY_RIGHT, 10);
    line(r.unit, X_UNIT, 10);
    right(money(r.unitPrice), X_UP_RIGHT, 10);
    right(money(r.extendedAmount), X_AMT_RIGHT, 10);
    y -= 19;
  }

  y -= 8;
  page.drawLine({
    start: { x: X_DESC, y },
    end: { x: X_AMT_RIGHT, y },
    thickness: 0.6,
    color: rgb(0.85, 0.86, 0.88),
  });
  y -= 18;

  for (const m of co.markups) {
    const label = m.percent !== undefined ? `${m.label} (${m.percent}%)` : m.label;
    line(label, X_DESC, 10, font, muted);
    right(money(m.amount), X_AMT_RIGHT, 10, font, muted);
    y -= 17;
  }
  line("Total", X_DESC, 11, bold);
  right(money(co.total), X_AMT_RIGHT, 11, bold);

  return doc.save();
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const co of SAMPLE_CHANGE_ORDERS) {
    const bytes = await buildPdf(co);
    const path = join(outDir, `${co.id}.pdf`);
    writeFileSync(path, bytes);
    console.log(`wrote ${path} (${bytes.length} bytes)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
