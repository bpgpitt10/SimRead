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

export const GS_PRO_FIELD_DEFINITIONS = GS_PRO_METRIC_CATALOG.map((entry) => ({
  key: entry.field,
  label: entry.canonicalLabel,
  aliases: entry.aliases,
  unit: entry.unit,
  expectedRange: entry.expectedRange,
}));

export type GsproFieldDefinition = (typeof GS_PRO_FIELD_DEFINITIONS)[number];
export type GsproFieldKey = GsproMetricCatalogField;
export const GS_PRO_TARGET_FIELD_LABELS = GS_PRO_LOOPER_REQUIRED_FIELDS.map(
  (field) =>
    GS_PRO_METRIC_CATALOG.find((entry) => entry.field === field)!.canonicalLabel,
);
export type GsproTargetFieldLabel = (typeof GS_PRO_TARGET_FIELD_LABELS)[number];
import {
  GS_PRO_LOOPER_REQUIRED_FIELDS,
  GS_PRO_METRIC_CATALOG,
  GsproMetricCatalogField,
} from "./gsproMetricCatalog";
