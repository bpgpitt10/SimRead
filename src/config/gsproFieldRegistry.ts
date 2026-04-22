export type GsproFieldCategory =
  | "distance"
  | "spin"
  | "launch"
  | "direction"
  | "club"
  | "impact"
  | "other";

export type GsproFieldRegistryEntry = {
  label: string;
  key: string;
  category: GsproFieldCategory;
  ogcRelevant: boolean;
  importance: "core" | "secondary" | "optional";
};

export const GS_PRO_FIELD_REGISTRY: GsproFieldRegistryEntry[] = [
  { label: "CARRY (game)", key: "carryGame", category: "distance", ogcRelevant: false, importance: "core" },
  { label: "CARRY (raw)", key: "carryRaw", category: "distance", ogcRelevant: false, importance: "secondary" },
  { label: "TOTAL LENGTH", key: "totalDistance", category: "distance", ogcRelevant: false, importance: "core" },
  { label: "PEAK HEIGHT", key: "peakHeight", category: "distance", ogcRelevant: false, importance: "secondary" },
  { label: "DESCENT ANGLE", key: "descentAngle", category: "launch", ogcRelevant: false, importance: "secondary" },
  { label: "VLA", key: "vla", category: "launch", ogcRelevant: true, importance: "core" },
  { label: "HLA", key: "hla", category: "direction", ogcRelevant: true, importance: "core" },
  { label: "OFFLINE (raw)", key: "offline", category: "direction", ogcRelevant: false, importance: "core" },
  { label: "TOTAL SPIN", key: "spin", category: "spin", ogcRelevant: true, importance: "core" },
  { label: "BACK SPIN", key: "backSpin", category: "spin", ogcRelevant: false, importance: "secondary" },
  { label: "SIDE SPIN", key: "sideSpin", category: "spin", ogcRelevant: false, importance: "secondary" },
  { label: "SPIN AXIS", key: "spinAxis", category: "spin", ogcRelevant: true, importance: "core" },
  { label: "SPIN LOFT", key: "spinLoft", category: "spin", ogcRelevant: false, importance: "optional" },
  { label: "BALL SPEED", key: "ballSpeed", category: "launch", ogcRelevant: true, importance: "core" },
  { label: "CLUB SPEED", key: "clubSpeed", category: "club", ogcRelevant: false, importance: "secondary" },
  { label: "CLUB PATH", key: "clubPath", category: "club", ogcRelevant: false, importance: "secondary" },
  { label: "CLUB AoA", key: "clubAoa", category: "club", ogcRelevant: false, importance: "secondary" },
  { label: "CLUB LIE", key: "clubLie", category: "club", ogcRelevant: false, importance: "optional" },
  { label: "CLUB LOFT", key: "clubLoft", category: "club", ogcRelevant: false, importance: "optional" },
  { label: "FACE TO TARGET", key: "faceToTarget", category: "direction", ogcRelevant: false, importance: "secondary" },
  { label: "FACE TO PATH", key: "faceToPath", category: "direction", ogcRelevant: false, importance: "secondary" },
  { label: "CLOSURE RATE", key: "closureRate", category: "club", ogcRelevant: false, importance: "optional" },
  { label: "SMASH FACTOR", key: "smashFactor", category: "club", ogcRelevant: false, importance: "optional" },
  { label: "HOR IMPACT", key: "horImpact", category: "impact", ogcRelevant: false, importance: "optional" },
  { label: "VERT IMPACT", key: "vertImpact", category: "impact", ogcRelevant: false, importance: "optional" },
  { label: "DIST TO PIN", key: "distToPin", category: "other", ogcRelevant: false, importance: "optional" },
  { label: "PUTT SPEED", key: "puttSpeed", category: "other", ogcRelevant: false, importance: "optional" },
];

export const GS_PRO_FIELD_KEYS = GS_PRO_FIELD_REGISTRY.map((field) => field.key);

export const GS_PRO_OGC_RELEVANT_KEYS = GS_PRO_FIELD_REGISTRY
  .filter((field) => field.ogcRelevant)
  .map((field) => field.key);

export const GS_PRO_CORE_KEYS = GS_PRO_FIELD_REGISTRY
  .filter((field) => field.importance === "core")
  .map((field) => field.key);
