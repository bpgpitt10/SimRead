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
};

export type CourseState = {
  summary?: string;
};

export type ExtractedFrame = {
  frame: {
    timestampMs: number;
    source: "screenshot";
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