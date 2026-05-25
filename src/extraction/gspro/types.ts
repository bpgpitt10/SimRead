export type GsproTileBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GsproTileRegion = {
  id: string;
  panel: "left" | "right";
  row: number;
  column: number;
  bounds: GsproTileBounds;
};

export type GsproTileText = {
  rawText?: string;
  valueText?: string;
  labelText?: string;
  confidence?: number;
  valueConfidence?: number;
  labelConfidence?: number;
};

export type GsproTileExtraction = {
  label?: string;
  key?: GsproFieldKey;
  value?: string;
  numericValue?: number;
  unit?: string;
  confidence?: number;
  bounds: GsproTileBounds;
  rawText?: string;
  valueText?: string;
  labelText?: string;
  warnings?: string[];
};

export type GsproFields = Partial<Record<GsproFieldKey, number>>;

export type GsproCaptureExtraction = {
  imagePath: string;
  ocrRan: boolean;
  ocrEngine: string;
  detectedTileRegionsCount: number;
  tiles: GsproTileExtraction[];
  normalizedTiles: GsproTileExtraction[];
  gsproFields: GsproFields;
  missingFields: string[];
  warnings: string[];
};

export const GS_PRO_FIELD_DEFINITIONS = [
  { key: "totalDistance", label: "Total Length", aliases: ["total length"] },
  { key: "carryGame", label: "Carry (game)", aliases: ["carry game", "carry (game)"] },
  { key: "carryRaw", label: "Carry (raw)", aliases: ["carry raw", "carry (raw)"] },
  { key: "offline", label: "Offline (raw)", aliases: ["offline raw", "offline (raw)", "offline"] },
  { key: "ballSpeed", label: "Ball Speed", aliases: ["ball speed"] },
  { key: "vla", label: "VLA", aliases: ["vla"] },
  { key: "hla", label: "HLA", aliases: ["hla"] },
  { key: "spin", label: "Total Spin", aliases: ["total spin"] },
  { key: "spinAxis", label: "Spin Axis", aliases: ["spin axis"] },
  { key: "peakHeight", label: "Peak Height", aliases: ["peak height"] },
  { key: "descentAngle", label: "Descent Angle", aliases: ["descent angle"] },
  { key: "backSpin", label: "Back Spin", aliases: ["back spin"] },
  { key: "sideSpin", label: "Side Spin", aliases: ["side spin"] },
] as const;

export type GsproFieldDefinition = (typeof GS_PRO_FIELD_DEFINITIONS)[number];
export type GsproFieldKey = GsproFieldDefinition["key"];
export const GS_PRO_TARGET_FIELD_LABELS = GS_PRO_FIELD_DEFINITIONS.map(
  (field) => field.label,
);
export type GsproTargetFieldLabel = (typeof GS_PRO_TARGET_FIELD_LABELS)[number];
