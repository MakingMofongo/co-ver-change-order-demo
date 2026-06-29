import { describe, expect, it } from "vitest";
import { parseChangeOrder, parseMoney } from "./parse";
import { getSample, renderChangeOrderText } from "../samples";

const co04 = renderChangeOrderText(getSample("co-04")!);
const co11 = renderChangeOrderText(getSample("co-11")!);

describe("parseMoney", () => {
  it("strips $ and commas", () => {
    expect(parseMoney("$11,520.00")).toBe(11520);
    expect(parseMoney("1850")).toBe(1850);
    expect(parseMoney("$2.85")).toBe(2.85);
  });
});

describe("parseChangeOrder — header", () => {
  const co = parseChangeOrder(co04);
  it("reads the change-order number", () => expect(co.number).toBe("CO-04"));
  it("reads the title", () => expect(co.title).toBe("Level 3 Electrical Revision"));
  it("reads the stated scope", () =>
    expect(co.statedScope).toMatch(/branch circuits and receptacles/i));
  it("reads the stated total", () => expect(co.statedTotal).toBe(63685.74));
});

describe("parseChangeOrder — line items", () => {
  const co = parseChangeOrder(co04);

  it("extracts every billed line (and ignores the column header row)", () => {
    expect(co.lineItems).toHaveLength(7);
    expect(co.lineItems.some((li) => /description/i.test(li.description))).toBe(false);
  });

  it("parses qty / unit / price / extended on a plain row", () => {
    const j = co.lineItems[0];
    expect(j.description).toBe("Journeyman electrician");
    expect(j.quantity).toBe(120);
    expect(j.unit).toBe("HR");
    expect(j.unitPrice).toBe(96);
    expect(j.extendedAmount).toBe(11520);
    expect(j.category).toBe("labor");
  });

  it("parses a description that begins with a number (#12 THHN)", () => {
    const w = co.lineItems[1];
    expect(w.description).toBe("#12 THHN branch wiring");
    expect(w.quantity).toBe(2400);
    expect(w.unit).toBe("LF");
    expect(w.unitPrice).toBe(2.85);
  });

  it("parses a description with embedded digits and punctuation (3/4\" EMT)", () => {
    const emt = co.lineItems[3];
    expect(emt.description).toBe('3/4" EMT conduit');
    expect(emt.quantity).toBe(1200);
    expect(emt.unitPrice).toBe(11.4);
  });
});

describe("parseChangeOrder — markups", () => {
  const co = parseChangeOrder(co04);
  it("captures subtotal, O&P with its percent, and tax", () => {
    const sub = co.markups.find((m) => m.kind === "subtotal");
    const op = co.markups.find((m) => m.kind === "overhead_profit");
    const tax = co.markups.find((m) => m.kind === "tax");
    expect(sub?.amount).toBe(48895);
    expect(op?.percent).toBe(22);
    expect(op?.amount).toBe(10756.9);
    expect(tax?.percent).toBe(8.25);
  });
});

describe("parseChangeOrder — a different document parses differently", () => {
  it("CO-11 yields its own items, not CO-04's", () => {
    const co = parseChangeOrder(co11);
    expect(co.number).toBe("CO-11");
    expect(co.lineItems).toHaveLength(4);
    expect(co.lineItems[0].description).toBe("VCT flooring, installed");
  });
});
