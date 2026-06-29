import type { Baseline } from "./types";

/**
 * The original contract baseline for the demo project.
 *
 * This stands in for the owner's approved contract schedule of values + the
 * agreed unit prices. Change orders are reviewed AGAINST these numbers.
 *
 * Sample data, labeled as such in the UI. In production this is whatever the
 * owner's contract documents establish (uploaded / ingested per project).
 */
export const DEMO_BASELINE: Baseline = {
  project: "Sienna Ridge Mixed-Use — Building B",
  contractNumber: "GC-2024-118",
  terms: {
    allowedOandPPct: 15,
    taxRatePct: 8.25,
  },
  unitPrices: [
    {
      key: "concrete_3000",
      description: "3000 PSI concrete, footings & slab",
      unit: "CY",
      unitPrice: 185.0,
      division: "03 - Concrete",
      match: ["concrete", "3000", "footing", "slab"],
    },
    {
      key: "rebar_60",
      description: "Reinforcing steel, Grade 60",
      unit: "LB",
      unitPrice: 1.15,
      division: "03 - Concrete",
      match: ["rebar", "reinforcing", "reinforcement", "grade 60"],
    },
    {
      key: "cmu_8",
      description: '8" CMU block wall',
      unit: "SF",
      unitPrice: 14.5,
      division: "04 - Masonry",
      match: ["cmu", "block wall", "masonry"],
    },
    {
      key: "metal_stud",
      description: '3-5/8" metal stud framing',
      unit: "SF",
      unitPrice: 4.8,
      division: "09 - Finishes",
      match: ["metal stud", "stud framing", "framing"],
    },
    {
      key: "drywall_58",
      description: '5/8" Type X drywall, hung & finished',
      unit: "SF",
      unitPrice: 3.25,
      division: "09 - Finishes",
      match: ["drywall", "gypsum", "type x", "wallboard"],
    },
    {
      key: "acoustic_ceiling",
      description: "2x2 acoustic ceiling tile + grid",
      unit: "SF",
      unitPrice: 6.4,
      division: "09 - Finishes",
      match: ["acoustic", "ceiling tile", "act ceiling", "ceiling grid"],
    },
    {
      key: "vct_floor",
      description: "VCT flooring, installed",
      unit: "SF",
      unitPrice: 4.1,
      division: "09 - Finishes",
      match: ["vct", "vinyl composition", "vinyl tile", "flooring"],
    },
    {
      key: "paint_2coat",
      description: "Interior paint, 2 coats",
      unit: "SF",
      unitPrice: 1.35,
      division: "09 - Finishes",
      match: ["paint", "painting", "2 coat", "two coat"],
    },
    {
      key: "emt_conduit",
      description: '3/4" EMT conduit, installed',
      unit: "LF",
      unitPrice: 9.5,
      division: "26 - Electrical",
      match: ["emt", "conduit"],
    },
    {
      key: "branch_wiring",
      description: "#12 THHN branch wiring",
      unit: "LF",
      unitPrice: 2.85,
      division: "26 - Electrical",
      match: ["thhn", "branch wiring", "branch circuit wire", "#12", "wiring"],
    },
    {
      key: "recep_20a",
      description: "20A duplex receptacle",
      unit: "EA",
      unitPrice: 145.0,
      division: "26 - Electrical",
      match: ["receptacle", "duplex", "outlet", "20a"],
    },
    {
      key: "led_troffer",
      description: "2x4 LED troffer fixture",
      unit: "EA",
      unitPrice: 285.0,
      division: "26 - Electrical",
      match: ["troffer", "led fixture", "light fixture", "luminaire"],
    },
    {
      key: "vav_box",
      description: "VAV terminal box w/ reheat",
      unit: "EA",
      unitPrice: 1850.0,
      division: "23 - HVAC",
      match: ["vav", "terminal box", "reheat"],
    },
    {
      key: "ductwork_galv",
      description: "Galvanized sheet-metal ductwork",
      unit: "LB",
      unitPrice: 8.75,
      division: "23 - HVAC",
      match: ["ductwork", "duct", "galvanized", "sheet metal"],
    },
    {
      key: "journeyman_elec",
      description: "Journeyman electrician",
      unit: "HR",
      unitPrice: 78.0,
      division: "26 - Electrical",
      match: ["journeyman", "electrician"],
    },
    {
      key: "laborer",
      description: "General laborer",
      unit: "HR",
      unitPrice: 42.0,
      division: "01 - General",
      match: ["laborer", "general labor", "labor"],
    },
    {
      key: "scissor_lift",
      description: "Scissor lift rental",
      unit: "DAY",
      unitPrice: 165.0,
      division: "01 - General",
      match: ["scissor lift", "lift rental", "man lift"],
    },
  ],
};
