export type GsproMetricCategory =
  | "outcome"
  | "ball"
  | "club"
  | "course"
  | "putting"
  | "other";

export type GsproMetricUnit =
  | "deg"
  | "distance"
  | "mph"
  | "rpm"
  | "ratio"
  | "rpmOrDegPerSecond"
  | "unknown";

export type GsproExpectedRange = {
  min: number;
  max: number;
};

export type GsproMetricCatalogEntry = {
  canonicalLabel: string;
  aliases: string[];
  field: string;
  unit: GsproMetricUnit;
  expectedRange: GsproExpectedRange;
  requiredForLooper?: boolean;
  requiredForOgc?: boolean;
  category?: GsproMetricCategory;
};

export const GS_PRO_METRIC_CATALOG = [
  {
    canonicalLabel: "Back Spin",
    aliases: ["back spin"],
    field: "backSpin",
    unit: "rpm",
    expectedRange: { min: -20000, max: 20000 },
    requiredForLooper: true,
    category: "ball",
  },
  {
    canonicalLabel: "Ball Speed",
    aliases: ["ball speed"],
    field: "ballSpeed",
    unit: "mph",
    expectedRange: { min: 0, max: 250 },
    requiredForLooper: true,
    requiredForOgc: true,
    category: "ball",
  },
  {
    canonicalLabel: "Carry (game)",
    aliases: ["carry game", "carry (game)"],
    field: "carryGame",
    unit: "distance",
    expectedRange: { min: 0, max: 500 },
    requiredForLooper: true,
    category: "outcome",
  },
  {
    canonicalLabel: "Carry (LM)",
    aliases: ["carry lm", "carry (lm)", "carry launch monitor"],
    field: "carryLm",
    unit: "distance",
    expectedRange: { min: 0, max: 500 },
    category: "outcome",
  },
  {
    canonicalLabel: "Carry (raw)",
    aliases: ["carry raw", "carry (raw)"],
    field: "carryRaw",
    unit: "distance",
    expectedRange: { min: 0, max: 500 },
    requiredForLooper: true,
    category: "outcome",
  },
  {
    canonicalLabel: "Club AoA",
    aliases: ["club aoa", "club angle of attack", "angle of attack", "aoa"],
    field: "clubAoa",
    unit: "deg",
    expectedRange: { min: -30, max: 30 },
    category: "club",
  },
  {
    canonicalLabel: "Club Closure Rate",
    aliases: ["club closure rate", "closure rate"],
    field: "closureRate",
    unit: "rpmOrDegPerSecond",
    expectedRange: { min: -10000, max: 10000 },
    category: "club",
  },
  {
    canonicalLabel: "Club Face H Impact",
    aliases: ["club face h impact", "face h impact", "horizontal impact", "hor impact"],
    field: "clubFaceHImpact",
    unit: "distance",
    expectedRange: { min: -100, max: 100 },
    category: "club",
  },
  {
    canonicalLabel: "Club FaceToPath",
    aliases: ["club facetopath", "club face to path", "face to path"],
    field: "faceToPath",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    category: "club",
  },
  {
    canonicalLabel: "Club FaceToTarget",
    aliases: ["club facetotarget", "club face to target", "face to target"],
    field: "faceToTarget",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    category: "club",
  },
  {
    canonicalLabel: "Club Face V Impact",
    aliases: ["club face v impact", "face v impact", "vertical impact", "vert impact"],
    field: "clubFaceVImpact",
    unit: "distance",
    expectedRange: { min: -100, max: 100 },
    category: "club",
  },
  {
    canonicalLabel: "Club Lie",
    aliases: ["club lie"],
    field: "clubLie",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    category: "club",
  },
  {
    canonicalLabel: "Club Loft",
    aliases: ["club loft", "dynamic loft"],
    field: "dynamicLoft",
    unit: "deg",
    expectedRange: { min: -10, max: 80 },
    category: "club",
  },
  {
    canonicalLabel: "Club Path",
    aliases: ["club path"],
    field: "clubPath",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    category: "club",
  },
  {
    canonicalLabel: "Club Speed",
    aliases: ["club speed"],
    field: "clubSpeed",
    unit: "mph",
    expectedRange: { min: 0, max: 180 },
    category: "club",
  },
  {
    canonicalLabel: "Club Spin Loft",
    aliases: ["club spin loft", "spin loft"],
    field: "spinLoft",
    unit: "deg",
    expectedRange: { min: -30, max: 90 },
    category: "club",
  },
  {
    canonicalLabel: "Descent Angle",
    aliases: ["descent angle"],
    field: "descentAngle",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    requiredForLooper: true,
    category: "ball",
  },
  {
    canonicalLabel: "Distance To Pin",
    aliases: ["distance to pin", "dist to pin"],
    field: "distToPin",
    unit: "distance",
    expectedRange: { min: 0, max: 800 },
    category: "course",
  },
  {
    canonicalLabel: "HLA",
    aliases: ["hla", "horizontal launch angle"],
    field: "hla",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    requiredForLooper: true,
    requiredForOgc: true,
    category: "ball",
  },
  {
    canonicalLabel: "Offline (raw)",
    aliases: ["offline raw", "offline (raw)", "offline"],
    field: "offline",
    unit: "distance",
    expectedRange: { min: -250, max: 250 },
    requiredForLooper: true,
    category: "outcome",
  },
  {
    canonicalLabel: "Peak Height",
    aliases: ["peak height"],
    field: "peakHeight",
    unit: "distance",
    expectedRange: { min: 0, max: 250 },
    requiredForLooper: true,
    category: "ball",
  },
  {
    canonicalLabel: "Putt Speed",
    aliases: ["putt speed"],
    field: "puttSpeed",
    unit: "mph",
    expectedRange: { min: 0, max: 40 },
    category: "putting",
  },
  {
    canonicalLabel: "Side Spin",
    aliases: ["side spin"],
    field: "sideSpin",
    unit: "rpm",
    expectedRange: { min: -20000, max: 20000 },
    requiredForLooper: true,
    category: "ball",
  },
  {
    canonicalLabel: "Smash Factor",
    aliases: ["smash factor"],
    field: "smashFactor",
    unit: "ratio",
    expectedRange: { min: 0, max: 2.5 },
    category: "club",
  },
  {
    canonicalLabel: "Spin Axis",
    aliases: ["spin axis"],
    field: "spinAxis",
    unit: "deg",
    expectedRange: { min: -90, max: 90 },
    requiredForLooper: true,
    requiredForOgc: true,
    category: "ball",
  },
  {
    canonicalLabel: "Total Length",
    aliases: ["total length", "total distance"],
    field: "totalDistance",
    unit: "distance",
    expectedRange: { min: 0, max: 500 },
    requiredForLooper: true,
    category: "outcome",
  },
  {
    canonicalLabel: "Total Spin",
    aliases: ["total spin"],
    field: "spin",
    unit: "rpm",
    expectedRange: { min: 0, max: 20000 },
    requiredForLooper: true,
    requiredForOgc: true,
    category: "ball",
  },
  {
    canonicalLabel: "VLA",
    aliases: ["vla", "vertical launch angle"],
    field: "vla",
    unit: "deg",
    expectedRange: { min: -30, max: 80 },
    requiredForLooper: true,
    requiredForOgc: true,
    category: "ball",
  },
] as const satisfies readonly GsproMetricCatalogEntry[];

export type GsproMetricCatalogField =
  (typeof GS_PRO_METRIC_CATALOG)[number]["field"];

export const GS_PRO_LOOPER_REQUIRED_FIELDS = GS_PRO_METRIC_CATALOG.filter(
  (entry) => "requiredForLooper" in entry && entry.requiredForLooper,
).map((entry) => entry.field);
