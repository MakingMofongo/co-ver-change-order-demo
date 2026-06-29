import { describe, expect, it } from "vitest";
import { matchBaseline, normalizeText } from "./normalize";
import { DEMO_BASELINE } from "./baseline";
import type { LineItem } from "./types";

function item(partial: Partial<LineItem>): LineItem {
  return {
    id: "x",
    description: "",
    quantity: 1,
    unit: "EA",
    unitPrice: 0,
    extendedAmount: 0,
    category: "material",
    ...partial,
  };
}

describe("normalizeText", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeText('3/4"  EMT   Conduit!!')).toBe("3/4 emt conduit");
  });
});

describe("matchBaseline", () => {
  it("matches a labor line by keyword + unit", () => {
    const m = matchBaseline(item({ description: "Journeyman electrician", unit: "HR" }), DEMO_BASELINE);
    expect(m?.key).toBe("journeyman_elec");
  });

  it("matches even with extra words around the keyword", () => {
    const m = matchBaseline(item({ description: "Galvanized sheet-metal ductwork", unit: "LB" }), DEMO_BASELINE);
    expect(m?.key).toBe("ductwork_galv");
  });

  it("does NOT match across a unit mismatch", () => {
    // Same keyword, wrong unit of measure -> no match.
    const m = matchBaseline(item({ description: "Journeyman electrician", unit: "EA" }), DEMO_BASELINE);
    expect(m).toBeNull();
  });

  it("returns null for a genuinely new item", () => {
    const m = matchBaseline(item({ description: "Decorative wood paneling, custom millwork", unit: "SF" }), DEMO_BASELINE);
    expect(m).toBeNull();
  });
});
