import type {
  ExtractedFrame,
  GsproPracticeFields,
  OgcEligibility,
  ResolvedPracticeShot,
} from "../../../types/extractionTypes";

export type GsproRangeShotRow = {
  id: number;
  dateCreated: string | number | null;
  shotData: string;
};

export type ParsedGsproRangeShot = {
  source: "gspro-range-db";
  rowId: number;
  dateCreated: string | number | null;
  gsproFields: GsproPracticeFields;
  resolvedShot: ResolvedPracticeShot;
  ogcEligibility: OgcEligibility;
  layoutSupport: LayoutSupport;
  layoutSupportMissingFields: string[];
  extractedFields: string[];
  missingFields: string[];
  rawShotData: unknown;
  frame: ExtractedFrame;
};

type ShotDataObject = Record<string, unknown>;
type NumericGsproPracticeField = NonNullable<{
  [Key in keyof GsproPracticeFields]: GsproPracticeFields[Key] extends
    | number
    | undefined
    ? Key
    : never;
}[keyof GsproPracticeFields]>;
type LayoutSupport = NonNullable<
  NonNullable<ExtractedFrame["practice"]>["layoutSupport"]
>;

type NumericMapping = {
  source: string;
  target: NumericGsproPracticeField;
};

const OGC_INPUT_FIELDS = [
  "ballSpeed",
  "vla",
  "hla",
  "spin",
  "spinAxis",
] as const satisfies readonly (keyof GsproPracticeFields)[];

const REQUIRED_LAYOUT_FIELDS = [
  "carry",
  "totalDistance",
  "offline",
] as const satisfies readonly (keyof GsproPracticeFields)[];

const KNOWN_FIELD_TARGETS = [
  "club",
  "carry",
  "carryGame",
  "carryLm",
  "totalDistance",
  "offline",
  "ballSpeed",
  "vla",
  "hla",
  "backSpin",
  "sideSpin",
  "spinAxis",
  "spin",
  "totalSpin",
  "peakHeight",
  "descentAngle",
  "distToPin",
  "clubSpeed",
  "clubPath",
  "clubAoa",
  "faceToTarget",
  "faceToPath",
  "clubLie",
  "clubLoft",
  "dynamicLoft",
  "closureRate",
  "clubFaceHImpact",
  "clubFaceVImpact",
  "smashFactor",
] as const satisfies readonly (keyof GsproPracticeFields)[];

const NUMERIC_MAPPINGS: NumericMapping[] = [
  { source: "Carry", target: "carry" },
  { source: "rawCarryGame", target: "carryGame" },
  { source: "rawCarryLM", target: "carryLm" },
  { source: "TotalDistance", target: "totalDistance" },
  { source: "Offline", target: "offline" },
  { source: "BallSpeed", target: "ballSpeed" },
  { source: "VLA", target: "vla" },
  { source: "HLA", target: "hla" },
  { source: "BackSpin", target: "backSpin" },
  { source: "SideSpin", target: "sideSpin" },
  { source: "rawSpinAxis", target: "spinAxis" },
  { source: "TotalSpin", target: "totalSpin" },
  { source: "Spin", target: "totalSpin" },
  { source: "PeakHeight", target: "peakHeight" },
  { source: "Decent", target: "descentAngle" },
  { source: "DistanceToPin", target: "distToPin" },
  { source: "ClubSpeed", target: "clubSpeed" },
  { source: "Path", target: "clubPath" },
  { source: "AoA", target: "clubAoa" },
  { source: "FaceToTarget", target: "faceToTarget" },
  { source: "FaceToPath", target: "faceToPath" },
  { source: "Lie", target: "clubLie" },
  { source: "Loft", target: "clubLoft" },
  { source: "DynamicLoft", target: "dynamicLoft" },
  { source: "CR", target: "closureRate" },
  { source: "HI", target: "clubFaceHImpact" },
  { source: "VI", target: "clubFaceVImpact" },
  { source: "SmashFactor", target: "smashFactor" },
];

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const toStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  return undefined;
};

const hasNumber = (
  fields: GsproPracticeFields,
  key: keyof GsproPracticeFields,
) => typeof fields[key] === "number";

const parseShotData = (shotData: string): ShotDataObject => {
  const parsed: unknown = JSON.parse(shotData);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("DrivingRangeShot.ShotData JSON was not an object");
  }

  return parsed as ShotDataObject;
};

const deriveTotalSpin = (fields: GsproPracticeFields) => {
  if (fields.totalSpin !== undefined) {
    return fields.totalSpin;
  }

  if (fields.spin !== undefined) {
    return fields.spin;
  }

  if (fields.backSpin === undefined || fields.sideSpin === undefined) {
    return undefined;
  }

  return roundToTwoDecimals(
    Math.sqrt(fields.backSpin ** 2 + fields.sideSpin ** 2),
  );
};

const mapGsproFields = (shotData: ShotDataObject): GsproPracticeFields => {
  const fields: GsproPracticeFields = {};
  const club = toStringValue(shotData.club);

  if (club !== undefined) {
    fields.club = club;
  }

  for (const mapping of NUMERIC_MAPPINGS) {
    const value = toNumber(shotData[mapping.source]);
    if (value !== undefined) {
      fields[mapping.target] = value;
    }
  }

  const totalSpin = deriveTotalSpin(fields);
  if (totalSpin !== undefined) {
    fields.totalSpin = totalSpin;
    fields.spin = totalSpin;
  }

  return fields;
};

const buildResolvedShot = (fields: GsproPracticeFields): ResolvedPracticeShot => {
  const spinWasDerived =
    fields.spin !== undefined &&
    fields.totalSpin !== undefined &&
    fields.backSpin !== undefined &&
    fields.sideSpin !== undefined;
  const shot: ResolvedPracticeShot = {};

  if (fields.club !== undefined) {
    shot.club = fields.club;
  }
  if (fields.carry !== undefined) {
    shot.carry = fields.carry;
    shot.carrySource = "gspro";
  } else if (fields.carryGame !== undefined) {
    shot.carry = fields.carryGame;
    shot.carrySource = "gspro";
  } else if (fields.carryLm !== undefined) {
    shot.carry = fields.carryLm;
    shot.carrySource = "gspro";
  }
  if (fields.totalDistance !== undefined) {
    shot.totalDistance = fields.totalDistance;
    shot.totalDistanceSource = "gspro";
  }
  if (fields.offline !== undefined) {
    shot.offline = fields.offline;
    shot.offlineSource = "gspro";
  }
  if (fields.ballSpeed !== undefined) {
    shot.ballSpeed = fields.ballSpeed;
    shot.ballSpeedSource = "gspro";
  }
  if (fields.vla !== undefined) {
    shot.vla = fields.vla;
    shot.vlaSource = "gspro";
  }
  if (fields.hla !== undefined) {
    shot.hla = fields.hla;
    shot.hlaSource = "gspro";
  }
  if (fields.spin !== undefined) {
    shot.spin = fields.spin;
    shot.spinSource = spinWasDerived ? "derived" : "gspro";
  }
  if (fields.spinAxis !== undefined) {
    shot.spinAxis = fields.spinAxis;
    shot.spinAxisSource = "gspro";
  }
  if (fields.peakHeight !== undefined) {
    shot.peakHeight = fields.peakHeight;
    shot.peakHeightSource = "gspro";
  }
  if (fields.descentAngle !== undefined) {
    shot.descentAngle = fields.descentAngle;
    shot.descentAngleSource = "gspro";
  }

  return shot;
};

const buildOgcEligibility = (fields: GsproPracticeFields): OgcEligibility => {
  const presentFields = OGC_INPUT_FIELDS.filter((field) => hasNumber(fields, field));
  const missingFields = OGC_INPUT_FIELDS.filter((field) => !hasNumber(fields, field));

  return {
    callable: missingFields.length === 0,
    recommended: missingFields.length === 0,
    presentFields,
    missingFields,
  };
};

const buildLayoutSupport = (fields: GsproPracticeFields): LayoutSupport => {
  const missingRequiredFields = REQUIRED_LAYOUT_FIELDS.filter(
    (field) => !hasNumber(fields, field),
  );

  return {
    isSupported: missingRequiredFields.length === 0,
    missingRequiredFields,
    missingRecommendedFields: OGC_INPUT_FIELDS.filter(
      (field) => !hasNumber(fields, field),
    ),
  };
};

const buildFrame = (
  row: GsproRangeShotRow,
  fields: GsproPracticeFields,
  resolvedShot: ResolvedPracticeShot,
  ogcEligibility: OgcEligibility,
  layoutSupport: LayoutSupport,
): ExtractedFrame => ({
  frame: {
    timestampMs: Date.now(),
    source: "gspro-range-db",
  },
  mode: "practice",
  practice: {
    club: fields.club ?? "unknown",
    tiles: [],
    statePhase: "post_shot",
    layoutSupport,
    gsproFields: fields,
    gsproVisibility: {
      visibleFields: Object.keys(fields).sort(),
      missingVisibleFields: KNOWN_FIELD_TARGETS.filter(
        (field) => fields[field] === undefined,
      ),
      completenessScore: roundToTwoDecimals(
        Object.keys(fields).length / KNOWN_FIELD_TARGETS.length,
      ),
      enrichmentRecommended: ogcEligibility.recommended,
    },
    resolvedShot,
    ogcEligibility,
  },
  confidence: {
    overall: layoutSupport?.isSupported ? 1 : 0,
  },
  provider: {
    name: "local-gspro-range-db",
    model: "DrivingRangeShot.ShotData",
  },
});

export const mapGsproRangeShotToFrame = (
  row: GsproRangeShotRow,
): ParsedGsproRangeShot => {
  const rawShotData = parseShotData(row.shotData);
  const gsproFields = mapGsproFields(rawShotData);
  const resolvedShot = buildResolvedShot(gsproFields);
  const ogcEligibility = buildOgcEligibility(gsproFields);
  const layoutSupport = buildLayoutSupport(gsproFields);
  const frame = buildFrame(
    row,
    gsproFields,
    resolvedShot,
    ogcEligibility,
    layoutSupport,
  );

  return {
    source: "gspro-range-db",
    rowId: row.id,
    dateCreated: row.dateCreated,
    gsproFields,
    resolvedShot,
    ogcEligibility,
    layoutSupport,
    layoutSupportMissingFields: layoutSupport?.missingRequiredFields ?? [],
    extractedFields: Object.keys(gsproFields).sort(),
    missingFields: KNOWN_FIELD_TARGETS.filter(
      (field) => gsproFields[field] === undefined,
    ),
    rawShotData,
    frame,
  };
};
