# Change Order Review

A working mini-app for reviewing construction **change orders** against the contract
baseline before paying them. Upload a change-order PDF (or load a sample), and it:

1. **Extracts** the line items, units, prices, scope and markups from the document.
2. **Compares** each line against the original contract's agreed unit prices and terms.
3. **Flags** likely overbilling — unit prices above contract, duplicate charges, math
   errors, excessive overhead & profit, out-of-scope work, and items with no contract price.
4. Lets a **human estimator approve or dispute** each finding, with the reasoning shown.
   The "adjusted payable" updates live as you dispute lines.

GCs routinely overbill change orders by 10–15%. This surfaces exactly where, with the
numbers behind every flag, so the owner can challenge it before releasing payment.

## The engine is real, not a mockup

The detection logic is a pure, unit-tested TypeScript module (`src/lib/engine/`). Every
flag is **computed from the actual document** against the baseline — feed it a different
change order and you get a different set of flags. Nothing is hardcoded.

- `parse.ts` — turns extracted text into structured line items + markups.
- `normalize.ts` — matches a billed line back to its contract unit price (unit-aware).
- `analyze.ts` — the checks: over-baseline, duplicate, math error, rollup mismatch,
  excessive markup, scope creep, no-baseline. Each flag carries the numbers it fired on.
- **32 unit tests** (`*.test.ts`): `npm test`.

## Two extraction paths

| Path | When | What |
|---|---|---|
| **LLM (Claude)** | Server build (Vercel/local) with `ANTHROPIC_API_KEY` | `/api/analyze` calls Claude (`claude-opus-4-8`) to extract line items from arbitrary, messy PDF layouts. The deterministic engine still does the money math — an LLM never invents the dollar figures on a financial review. |
| **On-device** | Static build (GitHub Pages), or as a fallback | pdf.js extracts the text in the browser and the deterministic parser structures it — no key, no server, fully client-side. |

The live demo (GitHub Pages) runs the **on-device** path. The Claude route is the production
wiring (drops cleanly onto Convex + the Anthropic API); set `ANTHROPIC_API_KEY` on a server
host to activate it.

## Sample documents

The three documents in the picker are **clearly-labeled samples** (real generated PDFs in
`public/samples/`, source data in `src/lib/samples.ts`), built to exercise each detector:

- **CO-04** — an aggressively-billed electrical revision (over-contract labor & conduit, a
  duplicated receptacle line, a math error, out-of-scope demo, 22% O&P).
- **CO-07** — a mostly clean HVAC addition (one line modestly over contract; the VAV line,
  ~4% over, is intentionally **not** flagged — the tool isn't trigger-happy).
- **CO-11** — clean finishes upgrade with one item that has no contract price (routed to an
  estimator) and a subtotal that doesn't foot.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind v4 · Anthropic API (server) · pdf.js · vitest.

## Run

```bash
npm install
npm test                 # engine tests
npm run dev              # http://localhost:3000  (set ANTHROPIC_API_KEY to enable Claude extraction)
npm run gen:samples      # regenerate the sample PDFs from src/lib/samples.ts
```
