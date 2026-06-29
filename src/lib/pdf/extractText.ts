/**
 * Client-side PDF text extraction.
 *
 * Uses pdf.js to pull text items, then reconstructs rows by clustering items
 * that share a vertical position and ordering them left-to-right. That yields
 * one logical line per row — exactly what both the deterministic parser and the
 * LLM extractor consume.
 *
 * pdf.js (and its worker) is imported + configured exactly once, lazily, only
 * when a real document is analyzed — it is not part of the initial page load.
 * Each extraction is timeout-guarded with a single retry on a fresh buffer copy
 * (getDocument detaches the input ArrayBuffer, so the retry needs its own copy),
 * so a one-off worker hiccup self-heals instead of stalling.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface TextItemLike {
  str: string;
  transform: number[];
}

type Pdfjs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<Pdfjs> | null = null;

function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("pdf-extract-timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function extractOnce(pdfjs: Pdfjs, data: ArrayBuffer): Promise<string> {
  const doc = await withTimeout(pdfjs.getDocument({ data }).promise, 12000);
  const lines: string[] = [];
  try {
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
  } finally {
    await doc.destroy();
  }
  return lines.join("\n");
}

export async function extractTextFromPdf(data: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  // Make both buffer copies up front: getDocument may detach its input, which
  // would make a copy taken after the first attempt throw.
  const first = data.slice(0);
  const second = data.slice(0);
  try {
    return await extractOnce(pdfjs, first);
  } catch {
    return await extractOnce(pdfjs, second);
  }
}

export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}
