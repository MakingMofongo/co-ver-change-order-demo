/**
 * Sample change orders for the demo, as structured data.
 *
 * One source of truth, used three ways:
 *   - the unit tests parse the rendered text and assert the engine's findings;
 *   - the PDF generator (scripts/gen-samples.mjs) lays these out as real PDFs;
 *   - at runtime the app extracts text from those PDFs and parses it back.
 *
 * Clearly labeled as sample data in the UI. The numbers are hand-built to
 * exercise each detector — they are NOT the engine's output.
 */

export interface SampleRow {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  extendedAmount: number;
}

export interface SampleMarkup {
  label: string;
  percent?: number;
  amount: number;
}

export interface SampleChangeOrder {
  id: string;
  number: string;
  title: string;
  project: string;
  date: string;
  scope: string;
  rows: SampleRow[];
  markups: SampleMarkup[];
  total: number;
  /** One-line characterisation for the sample switcher (honest labeling). */
  blurb: string;
}

export const SAMPLE_CHANGE_ORDERS: SampleChangeOrder[] = [
  {
    id: "co-04",
    number: "CO-04",
    title: "Level 3 Electrical Revision",
    project: "Sienna Ridge Mixed-Use — Building B",
    date: "2025-05-14",
    scope:
      "Add branch circuits and receptacles for revised Level 3 office layout per ASI-12.",
    rows: [
      { description: "Journeyman electrician", quantity: 120, unit: "HR", unitPrice: 96.0, extendedAmount: 11520.0 },
      { description: "#12 THHN branch wiring", quantity: 2400, unit: "LF", unitPrice: 2.85, extendedAmount: 6840.0 },
      { description: "20A duplex receptacle", quantity: 48, unit: "EA", unitPrice: 145.0, extendedAmount: 6960.0 },
      { description: '3/4" EMT conduit', quantity: 1200, unit: "LF", unitPrice: 11.4, extendedAmount: 13680.0 },
      { description: "20A duplex receptacle", quantity: 48, unit: "EA", unitPrice: 145.0, extendedAmount: 6960.0 },
      { description: "Demolition of existing partitions", quantity: 850, unit: "SF", unitPrice: 2.1, extendedAmount: 1785.0 },
      { description: "Scissor lift rental", quantity: 6, unit: "DAY", unitPrice: 165.0, extendedAmount: 1150.0 },
    ],
    markups: [
      { label: "Subtotal", amount: 48895.0 },
      { label: "Overhead & Profit", percent: 22, amount: 10756.9 },
      { label: "Tax", percent: 8.25, amount: 4033.84 },
    ],
    total: 63685.74,
    blurb: "Electrical revision — several aggressive lines",
  },
  {
    id: "co-07",
    number: "CO-07",
    title: "4th-Floor HVAC Addition",
    project: "Sienna Ridge Mixed-Use — Building B",
    date: "2025-06-02",
    scope:
      "Furnish and install VAV terminal boxes and associated ductwork for the 4th-floor HVAC revision.",
    rows: [
      { description: "VAV terminal box w/ reheat", quantity: 4, unit: "EA", unitPrice: 1925.0, extendedAmount: 7700.0 },
      { description: "Galvanized sheet-metal ductwork", quantity: 1850, unit: "LB", unitPrice: 9.25, extendedAmount: 17112.5 },
      { description: "General laborer", quantity: 64, unit: "HR", unitPrice: 42.0, extendedAmount: 2688.0 },
    ],
    markups: [
      { label: "Subtotal", amount: 27500.5 },
      { label: "Overhead & Profit", percent: 15, amount: 4125.08 },
      { label: "Tax", percent: 8.25, amount: 2268.79 },
    ],
    total: 33894.37,
    blurb: "HVAC addition — mostly in line with contract",
  },
  {
    id: "co-11",
    number: "CO-11",
    title: "Lobby Finishes Upgrade",
    project: "Sienna Ridge Mixed-Use — Building B",
    date: "2025-06-21",
    scope:
      "Upgrade lobby finishes including new flooring, paint, ceiling, and decorative millwork paneling per design bulletin DB-03.",
    rows: [
      { description: "VCT flooring, installed", quantity: 1200, unit: "SF", unitPrice: 4.1, extendedAmount: 4920.0 },
      { description: "Interior paint, 2 coats", quantity: 3400, unit: "SF", unitPrice: 1.35, extendedAmount: 4590.0 },
      { description: "2x2 acoustic ceiling tile + grid", quantity: 900, unit: "SF", unitPrice: 6.4, extendedAmount: 5760.0 },
      { description: "Decorative wood paneling, custom millwork", quantity: 320, unit: "SF", unitPrice: 38.0, extendedAmount: 12160.0 },
    ],
    markups: [
      { label: "Subtotal", amount: 28430.0 },
      { label: "Overhead & Profit", percent: 15, amount: 4264.5 },
      { label: "Tax", percent: 8.25, amount: 2345.48 },
    ],
    total: 35039.98,
    blurb: "Finishes upgrade — clean, one item needs pricing",
  },
];

/** Render a sample to the canonical change-order text the parser consumes. */
export function renderChangeOrderText(co: SampleChangeOrder): string {
  const money = (n: number) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines: string[] = [];
  lines.push(`CHANGE ORDER ${co.number}`);
  lines.push(`Project: ${co.project}`);
  lines.push(`Title: ${co.title}`);
  lines.push(`Date: ${co.date}`);
  lines.push(`Scope: ${co.scope}`);
  lines.push("");
  lines.push("DESCRIPTION QTY UNIT UNIT PRICE AMOUNT");
  for (const r of co.rows) {
    lines.push(
      `${r.description} ${r.quantity} ${r.unit} ${money(r.unitPrice)} ${money(r.extendedAmount)}`,
    );
  }
  lines.push("");
  for (const m of co.markups) {
    const pct = m.percent !== undefined ? ` (${m.percent}%)` : "";
    lines.push(`${m.label}${pct} ${money(m.amount)}`);
  }
  lines.push(`Total ${money(co.total)}`);
  return lines.join("\n");
}

export function getSample(id: string): SampleChangeOrder | undefined {
  return SAMPLE_CHANGE_ORDERS.find((c) => c.id === id);
}
