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