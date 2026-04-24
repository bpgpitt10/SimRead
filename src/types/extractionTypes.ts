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
  carryGame?: number;
  carryRaw?: number;
  totalDistance?: number;
  spin?: number;
  spinAxis?: number;
  hla?: number;
  vla?: number;
  ballSpeed?: number;
  peakHeight?: number;
  offline?: number;
  clubPath?: number;
  clubAoa?: number;
  faceToTarget?: number;
  faceToPath?: number;
  backSpin?: number;
  sideSpin?: number;
  clubSpeed?: number;
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
    source: "screenshot" | "mock";
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
