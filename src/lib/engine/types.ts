// Core domain types for change-order review.
// Everything here is plain data — the engine functions are pure and operate on these.

export type LineCategory =
  | "labor"
  | "material"
  | "equipment"
  | "subcontractor"
  | "other";

/** A single billed row on a change order. */
export interface LineItem {
  /** Stable id within a change order (row index based). */
  id: string;
  description: string;
  /** CSI MasterFormat division label, when known (e.g. "26 - Electrical"). */
  division?: string;
  quantity: number;
  /** Unit of measure: EA, LF, SF, CY, LB, HR, DAY, LS, etc. */
  unit: string;
  unitPrice: number;
  /** Amount as billed on the document (qty x unitPrice, per the GC). */
  extendedAmount: number;
  category: LineCategory;
}

/** A markup / rollup line (Overhead & Profit, Tax, Bond). */
export interface MarkupLine {
  kind: "subtotal" | "overhead_profit" | "tax" | "bond" | "total";
  label: string;
  /** Stated percentage, when the document expresses it as one (e.g. 22 for 22%). */
  percent?: number;
  amount: number;
}

/** A parsed change order. */
export interface ChangeOrder {
  number: string;
  title: string;
  /** The work the change order claims to cover, in the GC's own words. */
  statedScope: string;
  lineItems: LineItem[];
  markups: MarkupLine[];
  /** Bottom-line total as stated on the document. */
  statedTotal: number;
}

/** One agreed unit price from the original contract / schedule of values. */
export interface BaselineUnitPrice {
  key: string;
  description: string;
  unit: string;
  unitPrice: number;
  division: string;
  /** Keywords used to match a change-order line back to this contract item. */
  match: string[];
}

export interface ContractTerms {
  /** Allowed overhead & profit on self-performed work, percent. */
  allowedOandPPct: number;
  /** Sales/use tax rate applied to materials, percent. */
  taxRatePct: number;
}

export interface Baseline {
  project: string;
  contractNumber: string;
  unitPrices: BaselineUnitPrice[];
  terms: ContractTerms;
}

export type FlagType =
  | "over_baseline"
  | "duplicate"
  | "math_error"
  | "rollup_error"
  | "excessive_markup"
  | "scope_creep"
  | "no_baseline";

export type Severity = "critical" | "high" | "medium" | "low";

/** A single finding raised against a change order, with the numbers behind it. */
export interface Flag {
  id: string;
  type: FlagType;
  severity: Severity;
  /** Which line item this concerns ("" for document-level flags like rollup). */
  lineItemId: string;
  title: string;
  /** Plain explanation of what the engine computed and why it fired. */
  detail: string;
  /** Dollars at issue: the amount a reviewer could recover if the flag holds. */
  exposure: number;
  /** Structured numbers behind the flag, for the review panel to render. */
  computed: Record<string, number | string>;
}

export interface ReviewSummary {
  lineItemCount: number;
  flaggedCount: number;
  /** Sum of line items + markups as billed. */
  billedTotal: number;
  /** Total dollars the flags put at issue. */
  exposure: number;
}

export interface ReviewResult {
  changeOrder: ChangeOrder;
  flags: Flag[];
  summary: ReviewSummary;
}
