import { describe, expect, it } from "vitest";
import { analyzeChangeOrder, reviewChangeOrder } from "./analyze";
import { parseChangeOrder } from "./parse";
import { DEMO_BASELINE } from "./baseline";
import { getSample, renderChangeOrderText } from "../samples";
import type { ChangeOrder, FlagType, LineItem } from "./types";

function li(partial: Partial<LineItem>): LineItem {
  return {
    id: "li-0",
    description: "",
    quantity: 1,
    unit: "EA",
    unitPrice: 0,
    extendedAmount: 0,
    category: "material",
    ...partial,
  };
}

function co(partial: Partial<ChangeOrder>): ChangeOrder {
  return {
    number: "CO-T",
    title: "test",
    statedScope: "",
    lineItems: [],
    markups: [],
    statedTotal: 0,
    ...partial,
  };
}

const types = (fs: { type: FlagType }[]) => fs.map((f) => f.type);
function review(id: string) {
  return reviewChangeOrder(parseChangeOrder(renderChangeOrderText(getSample(id)!)), DEMO_BASELINE);
}

describe("math_error", () => {
  it("fires when extended != qty x unit price, with the right difference", () => {
    const flags = analyzeChangeOrder(
      co({ lineItems: [li({ quantity: 6, unit: "DAY", unitPrice: 165, extendedAmount: 1150 })] }),
      DEMO_BASELINE,
    );
    const m = flags.find((f) => f.type === "math_error");
    expect(m).toBeTruthy();
    expect(m!.computed.difference).toBe(160); // 1150 - 990
  });

  it("does not fire when the math is correct", () => {
    const flags = analyzeChangeOrder(
      co({ lineItems: [li({ quantity: 6, unit: "DAY", unitPrice: 165, extendedAmount: 990 })] }),
      DEMO_BASELINE,
    );
    expect(types(flags)).not.toContain("math_error");
  });
});

describe("over_baseline", () => {
  it("flags a unit price well over contract as critical", () => {
    const flags = analyzeChangeOrder(
      co({ lineItems: [li({ description: "Journeyman electrician", unit: "HR", quantity: 120, unitPrice: 96, extendedAmount: 11520 })] }),
      DEMO_BASELINE,
    );
    const f = flags.find((x) => x.type === "over_baseline");
    expect(f?.severity).toBe("critical");
    expect(f?.exposure).toBe(2160); // (96-78)*120
  });

  it("respects the tolerance: ~4% over does NOT fire, ~6% does", () => {
    const under = analyzeChangeOrder(
      co({ lineItems: [li({ description: "VAV terminal box w/ reheat", unit: "EA", quantity: 4, unitPrice: 1925, extendedAmount: 7700 })] }),
      DEMO_BASELINE,
    ); // 1925 vs 1850 = +4.05%
    expect(types(under)).not.toContain("over_baseline");

    const over = analyzeChangeOrder(
      co({ lineItems: [li({ description: "Galvanized sheet-metal ductwork", unit: "LB", quantity: 1850, unitPrice: 9.25, extendedAmount: 17112.5 })] }),
      DEMO_BASELINE,
    ); // 9.25 vs 8.75 = +5.71%
    expect(types(over)).toContain("over_baseline");
  });
});

describe("duplicate", () => {
  it("flags a repeated identical line once", () => {
    const row = { description: "20A duplex receptacle", unit: "EA", quantity: 48, unitPrice: 145, extendedAmount: 6960 };
    const flags = analyzeChangeOrder(
      co({ lineItems: [li({ id: "li-0", ...row }), li({ id: "li-1", ...row })] }),
      DEMO_BASELINE,
    );
    const dups = flags.filter((f) => f.type === "duplicate");
    expect(dups).toHaveLength(1);
    expect(dups[0].lineItemId).toBe("li-1");
    expect(dups[0].exposure).toBe(6960);
  });

  it("does not flag distinct lines", () => {
    const flags = analyzeChangeOrder(
      co({
        lineItems: [
          li({ id: "li-0", description: "20A duplex receptacle", unit: "EA", quantity: 48, unitPrice: 145, extendedAmount: 6960 }),
          li({ id: "li-1", description: "2x4 LED troffer fixture", unit: "EA", quantity: 18, unitPrice: 285, extendedAmount: 5130 }),
        ],
      }),
      DEMO_BASELINE,
    );
    expect(types(flags)).not.toContain("duplicate");
  });
});

describe("scope vs no-baseline", () => {
  it("flags an unmatched line unrelated to scope as scope_creep", () => {
    const flags = analyzeChangeOrder(
      co({
        statedScope: "Add branch circuits and receptacles for revised Level 3 office layout.",
        lineItems: [li({ description: "Demolition of existing partitions", unit: "SF", quantity: 850, unitPrice: 2.1, extendedAmount: 1785 })],
      }),
      DEMO_BASELINE,
    );
    expect(types(flags)).toContain("scope_creep");
  });

  it("routes an unmatched but in-scope line to estimator review (no_baseline)", () => {
    const flags = analyzeChangeOrder(
      co({
        statedScope: "Upgrade lobby finishes including decorative millwork paneling.",
        lineItems: [li({ description: "Decorative wood paneling, custom millwork", unit: "SF", quantity: 320, unitPrice: 38, extendedAmount: 12160 })],
      }),
      DEMO_BASELINE,
    );
    expect(types(flags)).toContain("no_baseline");
    expect(types(flags)).not.toContain("scope_creep");
  });
});

describe("excessive_markup", () => {
  it("flags O&P above the contract-allowed rate", () => {
    const flags = analyzeChangeOrder(
      co({ markups: [{ kind: "subtotal", label: "Subtotal", amount: 48895 }, { kind: "overhead_profit", label: "O&P", percent: 22, amount: 10756.9 }] }),
      DEMO_BASELINE,
    );
    const f = flags.find((x) => x.type === "excessive_markup");
    expect(f).toBeTruthy();
    expect(f!.exposure).toBe(3422.65); // 48895 * (22-15)/100
  });

  it("does not flag O&P at the allowed rate", () => {
    const flags = analyzeChangeOrder(
      co({ markups: [{ kind: "subtotal", label: "Subtotal", amount: 27500.5 }, { kind: "overhead_profit", label: "O&P", percent: 15, amount: 4125.08 }] }),
      DEMO_BASELINE,
    );
    expect(types(flags)).not.toContain("excessive_markup");
  });
});

describe("rollup_error", () => {
  it("flags a stated subtotal that doesn't match the line items", () => {
    const flags = analyzeChangeOrder(
      co({
        lineItems: [li({ description: "VCT flooring, installed", unit: "SF", quantity: 1200, unitPrice: 4.1, extendedAmount: 4920 })],
        markups: [{ kind: "subtotal", label: "Subtotal", amount: 5920 }],
      }),
      DEMO_BASELINE,
    );
    const f = flags.find((x) => x.type === "rollup_error");
    expect(f).toBeTruthy();
    expect(f!.computed.computedSubtotal).toBe(4920);
  });
});

describe("integration over the sample documents", () => {
  it("CO-04 surfaces the full mix of problems", () => {
    const { flags } = review("co-04");
    const t = types(flags);
    expect(t.filter((x) => x === "over_baseline")).toHaveLength(2);
    expect(t).toContain("duplicate");
    expect(t).toContain("math_error");
    expect(t).toContain("scope_creep");
    expect(t).toContain("excessive_markup");
  });

  it("CO-07 is mostly clean — one medium over-baseline, VAV under tolerance", () => {
    const { flags } = review("co-07");
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe("over_baseline");
    expect(flags[0].severity).toBe("medium");
  });

  it("CO-11 routes the new item for review and catches the subtotal slip", () => {
    const { flags } = review("co-11");
    const t = types(flags);
    expect(t).toContain("no_baseline");
    expect(t).toContain("rollup_error");
    expect(t).not.toContain("over_baseline");
  });
});

describe("the engine is real, not canned", () => {
  it("different documents produce different findings and exposure", () => {
    const a = review("co-04");
    const b = review("co-07");
    expect(a.flags.length).not.toBe(b.flags.length);
    expect(a.summary.exposure).not.toBe(b.summary.exposure);
    expect(a.summary.exposure).toBeGreaterThan(0);
  });

  it("changing a single input changes the output", () => {
    const base = co({ lineItems: [li({ description: "Journeyman electrician", unit: "HR", quantity: 120, unitPrice: 78, extendedAmount: 9360 })] });
    expect(types(analyzeChangeOrder(base, DEMO_BASELINE))).not.toContain("over_baseline");
    const bumped = { ...base, lineItems: [{ ...base.lineItems[0], unitPrice: 96, extendedAmount: 11520 }] };
    expect(types(analyzeChangeOrder(bumped, DEMO_BASELINE))).toContain("over_baseline");
  });
});
