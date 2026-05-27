export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TileValue = {
  label: string;
  value: number | string;
  unit?: string;
  bounds: Rect;
  confidence?: number;
  rawText?: string;
};

export type GsproPracticeFields = {
  club?: string;
  carry?: number;
  carryGame?: number;
  carryRaw?: number;
  carryLm?: number;
  totalDistance?: number;
  totalSpin?: number;
  spin?: number;
  spinAxis?: number;
  hla?: number;
  vla?: number;
  ballSpeed?: number;
  peakHeight?: number;
  descentAngle?: number;
  offline?: number;
  clubPath?: number;
  clubAoa?: number;
  faceToTarget?: number;
  faceToPath?: number;
  backSpin?: number;
  sideSpin?: number;
  clubSpeed?: number;
  clubLie?: number;
  clubLoft?: number;
  dynamicLoft?: number;
  closureRate?: number;
  clubFaceHImpact?: number;
  clubFaceVImpact?: number;
  smashFactor?: number;
  distToPin?: number;
};

export type GsproVisibility = {
  visibleFields: string[];
  missingVisibleFields: string[];
  completenessScore?: number;
  enrichmentRecommended?: boolean;
};

export type ResolvedShotFieldSource = "gspro" | "ogc" | "derived" | "missing";

export type ResolvedPracticeShot = {
  club?: string;
  carry?: number;
  carrySource?: ResolvedShotFieldSource;
  totalDistance?: number;
  totalDistanceSource?: ResolvedShotFieldSource;
  spin?: number;
  spinSource?: ResolvedShotFieldSource;
  spinAxis?: number;
  spinAxisSource?: ResolvedShotFieldSource;
  hla?: number;
  hlaSource?: ResolvedShotFieldSource;
  vla?: number;
  vlaSource?: ResolvedShotFieldSource;
  ballSpeed?: number;
  ballSpeedSource?: ResolvedShotFieldSource;
  peakHeight?: number;
  peakHeightSource?: ResolvedShotFieldSource;
  descentAngle?: number;
  descentAngleSource?: ResolvedShotFieldSource;
  offline?: number;
  offlineSource?: ResolvedShotFieldSource;
  enrichmentRecommended?: boolean;
};

export type OgcEligibility = {
  callable: boolean;
  recommended: boolean;
  presentFields: string[];
  missingFields: string[];
};

export type PracticeState = {
  club?: string;
  tiles: TileValue[];
  shotCount?: number;
  statePhase?: "pre_shot" | "post_shot" | "unknown";
  layoutSupport?: {
    isSupported: boolean;
    missingRequiredFields?: string[];
    missingRecommendedFields?: string[];
  };
  gsproFields?: GsproPracticeFields;
  gsproVisibility?: GsproVisibility;
  resolvedShot?: ResolvedPracticeShot;
  ogcEligibility?: OgcEligibility;
};

export type CourseState = {
  summary?: string;
};

export type ExtractedFrame = {
  frame: {
    timestampMs: number;
    source:
      | "screenshot"
      | "mock"
      | "windows-capture"
      | "ocr-debug-capture"
      | "gspro-range-db";
  };
  mode: "practice" | "course";
  practice?: PracticeState;
  course?: CourseState;
  confidence: {
    overall?: number;
  };
  provider: {
    name: string;
    model?: string;
  };
};
