/**
 * Client-side PDF text extraction.
 *
 * Uses pdf.js to pull text items, then reconstructs rows by clustering items
 * that share a vertical position and ordering them left-to-right. That yields
 * one logical line per row — exactly what both the deterministic parser and the
 * LLM extractor consume.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface TextItemLike {
  str: string;
  transform: number[];
}

export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;

  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = (content.items as TextItemLike[]).filter(
      (it) => typeof it.str === "string",
    );

    // Cluster items into rows by their y coordinate (transform[5]).
    type Row = { y: number; items: { x: number; str: string }[] };
    const rows: Row[] = [];
    const tolerance = 3;
    for (const it of items) {
      const x = it.transform[4];
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= tolerance);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, str: it.str });
    }

    rows.sort((a, b) => b.y - a.y); // top of page first
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const text = row.items
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) lines.push(text);
    }
  }

  await doc.destroy();
  return lines.join("\n");
}

export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}
