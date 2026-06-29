import { describe, expect, it } from "vitest";
import {
  DEMO_BASELINE,
  parseChangeOrder,
  analyzeChangeOrder,
} from "@/lib/engine";
import { getSample, renderChangeOrderText } from "@/lib/samples";
import { buildDisputeLetter } from "./disputeLetter";
import type { Decision } from "./format";

function co04() {
  const co = parseChangeOrder(renderChangeOrderText(getSample("co-04")!));
  const flags = analyzeChangeOrder(co, DEMO_BASELINE);
  return { co, flags };
}

describe("buildDisputeLetter", () => {
  it("returns empty when nothing is disputed", () => {
    const { co, flags } = co04();
    expect(buildDisputeLetter(co, flags, {}, DEMO_BASELINE)).toBe("");
  });

  it("composes a letter from the actually-disputed findings", () => {
    const { co, flags } = co04();
    // Dispute the duplicate and the worst over-baseline line.
    const dup = flags.find((f) => f.type === "duplicate")!;
    const over = flags
      .filter((f) => f.type === "over_baseline")
      .sort((a, b) => b.exposure - a.exposure)[0];
    const decisions: Record<string, Decision> = {
      [dup.id]: "disputed",
      [over.id]: "disputed",
    };

    const letter = buildDisputeLetter(co, flags, decisions, DEMO_BASELINE);

    expect(letter).toContain("CO-04");
    expect(letter).toContain(DEMO_BASELINE.project);
    expect(letter).toContain("20A duplex receptacle"); // the duplicated line
    expect(letter).toContain("dispute the following 2 items");
    // Total must equal the de-duplicated disputed exposure.
    const total = dup.exposure + over.exposure;
    expect(letter).toContain(
      total.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }),
    );
  });

  it("reflects different disputes (real, not canned)", () => {
    const { co, flags } = co04();
    const a = flags[0];
    const b = flags[1];
    const onlyA = buildDisputeLetter(co, flags, { [a.id]: "disputed" }, DEMO_BASELINE);
    const onlyB = buildDisputeLetter(co, flags, { [b.id]: "disputed" }, DEMO_BASELINE);
    expect(onlyA).not.toBe(onlyB);
    expect(onlyA).toContain("1 item ");
  });
});
