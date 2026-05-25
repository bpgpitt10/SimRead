import {
  ExtractedFrame,
  GsproPracticeFields,
  OgcEligibility,
  ResolvedPracticeShot,
  TileValue,
} from "../../types/extractionTypes";
import {
  GS_PRO_LOOPER_REQUIRED_FIELDS,
  GS_PRO_METRIC_CATALOG,
} from "./gsproMetricCatalog";
import { GsproCaptureExtraction, GsproFieldKey } from "./types";

const OGC_INPUT_FIELDS: GsproFieldKey[] = [
  "ballSpeed",
  "vla",
  "hla",
  "spin",
  "spinAxis",
];

const OUTCOME_REQUIRED_FIELDS = ["carry", "totalDistance", "offline"] as const;

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const hasNumber = (
  fields: GsproCaptureExtraction["gsproFields"],
  key: GsproFieldKey,
) => typeof fields[key] === "number";

const buildPracticeTiles = (extraction: GsproCaptureExtraction): TileValue[] =>
  extraction.normalizedTiles
    .filter(
      (tile) =>
        tile.label !== undefined &&
        tile.numericValue !== undefined &&
        tile.key !== undefined,
    )
    .map((tile) => {
      const value: TileValue = {
        label: tile.label!,
        value: tile.numericValue!,
        bounds: tile.bounds,
      };

      if (tile.unit !== undefined) {
        value.unit = tile.unit;
      }
      if (tile.confidence !== undefined) {
        value.confidence = tile.confidence;
      }
      if (tile.rawText !== undefined) {
        value.rawText = tile.rawText;
      }

      return value;
    });

const buildGsproFields = (
  fields: GsproCaptureExtraction["gsproFields"],
): GsproPracticeFields => {
  const practiceFields: GsproPracticeFields = {};
  const supportedKeys: Array<keyof GsproPracticeFields & GsproFieldKey> = [
    "carryGame",
    "carryRaw",
    "carryLm",
    "totalDistance",
    "spin",
    "spinAxis",
    "hla",
    "vla",
    "ballSpeed",
    "peakHeight",
    "descentAngle",
    "offline",
    "clubPath",
    "clubAoa",
    "faceToTarget",
    "faceToPath",
    "backSpin",
    "sideSpin",
    "clubSpeed",
  ];

  for (const key of supportedKeys) {
    const value = fields[key];
    if (typeof value === "number") {
      practiceFields[key] = value;
    }
  }

  return practiceFields;
};

const buildVisibility = (extraction: GsproCaptureExtraction) => {
  const visibleFields = Object.entries(extraction.gsproFields)
    .filter(([, value]) => typeof value === "number")
    .map(([key]) => key)
    .sort();
  const visibleFieldSet = new Set(visibleFields);
  const allCatalogFields = GS_PRO_METRIC_CATALOG.map((entry) => entry.field);

  return {
    visibleFields,
    missingVisibleFields: allCatalogFields.filter(
      (field) => !visibleFieldSet.has(field),
    ),
    completenessScore: roundToTwoDecimals(
      visibleFields.length / allCatalogFields.length,
    ),
    enrichmentRecommended: OGC_INPUT_FIELDS.some(
      (field) => !visibleFieldSet.has(field),
    ),
  };
};

const buildResolvedShot = (
  fields: GsproCaptureExtraction["gsproFields"],
): ResolvedPracticeShot => {
  const carry = fields.carryGame ?? fields.carryRaw ?? fields.carryLm;
  const shot: ResolvedPracticeShot = {
    club: "unknown",
    enrichmentRecommended: OGC_INPUT_FIELDS.some(
      (field) => !hasNumber(fields, field),
    ),
  };

  if (carry !== undefined) {
    shot.carry = carry;
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
    shot.spinSource = "gspro";
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

const buildOgcEligibility = (
  fields: GsproCaptureExtraction["gsproFields"],
): OgcEligibility => {
  const presentFields = OGC_INPUT_FIELDS.filter((field) => hasNumber(fields, field));
  const missingFields = OGC_INPUT_FIELDS.filter((field) => !hasNumber(fields, field));

  return {
    callable: missingFields.length === 0,
    recommended: missingFields.length === 0,
    presentFields,
    missingFields,
  };
};

const buildLayoutSupport = (fields: GsproCaptureExtraction["gsproFields"]) => {
  const hasCarry =
    hasNumber(fields, "carryGame") ||
    hasNumber(fields, "carryRaw") ||
    hasNumber(fields, "carryLm");
  const missingRequiredFields: string[] = [];

  if (!hasCarry) {
    missingRequiredFields.push("carryGame|carryRaw|carryLm");
  }
  if (!hasNumber(fields, "totalDistance")) {
    missingRequiredFields.push("totalDistance");
  }
  if (!hasNumber(fields, "offline")) {
    missingRequiredFields.push("offline");
  }

  return {
    isSupported: missingRequiredFields.length === 0,
    missingRequiredFields,
    missingRecommendedFields: GS_PRO_LOOPER_REQUIRED_FIELDS.filter(
      (field) => !hasNumber(fields, field as GsproFieldKey),
    ),
  };
};

const buildOverallConfidence = (extraction: GsproCaptureExtraction) => {
  const confidences = extraction.normalizedTiles
    .map((tile) => tile.confidence)
    .filter((confidence): confidence is number => confidence !== undefined);
  const confidenceAverage =
    confidences.length === 0
      ? 0
      : confidences.reduce((sum, confidence) => sum + confidence, 0) /
        confidences.length /
        100;
  const requiredCoverage =
    OUTCOME_REQUIRED_FIELDS.filter((field) => {
      if (field === "carry") {
        return (
          hasNumber(extraction.gsproFields, "carryGame") ||
          hasNumber(extraction.gsproFields, "carryRaw") ||
          hasNumber(extraction.gsproFields, "carryLm")
        );
      }

      return hasNumber(extraction.gsproFields, field);
    }).length / OUTCOME_REQUIRED_FIELDS.length;

  if (!extraction.ocrRan) {
    return 0;
  }

  return roundToTwoDecimals(confidenceAverage * 0.6 + requiredCoverage * 0.4);
};

export type BuildGsproPracticeFrameOptions = {
  source?: ExtractedFrame["frame"]["source"];
  timestampMs?: number;
};

export const buildGsproPracticeFrame = (
  extraction: GsproCaptureExtraction,
  options: BuildGsproPracticeFrameOptions = {},
): ExtractedFrame => {
  const gsproVisibility = buildVisibility(extraction);
  const resolvedShot = buildResolvedShot(extraction.gsproFields);
  const ogcEligibility = buildOgcEligibility(extraction.gsproFields);
  const layoutSupport = buildLayoutSupport(extraction.gsproFields);

  return {
    frame: {
      timestampMs: options.timestampMs ?? Date.now(),
      source: options.source ?? "ocr-debug-capture",
    },
    mode: "practice",
    practice: {
      club: "unknown",
      tiles: buildPracticeTiles(extraction),
      statePhase: "post_shot",
      layoutSupport,
      gsproFields: buildGsproFields(extraction.gsproFields),
      gsproVisibility,
      resolvedShot,
      ogcEligibility,
    },
    confidence: {
      overall: buildOverallConfidence(extraction),
    },
    provider: {
      name: "local-gspro-ocr",
      model: extraction.ocrEngine,
    },
  };
};
