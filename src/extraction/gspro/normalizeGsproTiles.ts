import {
  GS_PRO_FIELD_DEFINITIONS,
  GsproCaptureExtraction,
  GsproFieldDefinition,
  GsproFieldKey,
  GsproFields,
  GsproTileExtraction,
  GsproTileRegion,
  GsproTileText,
} from "./types";

type ParsedTile = GsproTileExtraction & {
  matchScore?: number;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeLabelText = (value: string) =>
  normalizeWhitespace(value)
    .replace(/[|_[\]{}]/g, " ")
    .replace(/[^\da-zA-Z() ]/g, " ")
    .replace(/\bRAW\b/gi, "(raw)")
    .replace(/\bGAME\b/gi, "(game)")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const valuePattern = /[-+]?(?:\d+\.\d+|\d+|\.\d+)/;

const levenshteinDistance = (left: string, right: string) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex]! + 1,
        current[rightIndex - 1]! + 1,
        previous[rightIndex - 1]! + substitutionCost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index]!;
    }
  }

  return previous[right.length]!;
};

const labelCandidatesForField = (field: GsproFieldDefinition) => [
  field.label,
  ...field.aliases,
];

const bestLabelMatch = (
  text: string,
): { field: GsproFieldDefinition; score: number } | undefined => {
  const normalizedText = normalizeLabelText(text);

  if (!normalizedText) {
    return undefined;
  }

  let best:
    | { field: GsproFieldDefinition; score: number; candidate: string }
    | undefined;

  for (const field of GS_PRO_FIELD_DEFINITIONS) {
    for (const candidate of labelCandidatesForField(field)) {
      const normalizedCandidate = normalizeLabelText(candidate);
      const directMatch =
        normalizedText === normalizedCandidate ||
        normalizedText.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedText);
      const distance = directMatch
        ? 0
        : levenshteinDistance(normalizedText, normalizedCandidate);
      const longest = Math.max(normalizedText.length, normalizedCandidate.length);
      const score = directMatch ? 1 : 1 - distance / longest;

      if (!best || score > best.score) {
        best = { field, score, candidate: normalizedCandidate };
      }
    }
  }

  if (!best || best.score < 0.68) {
    return undefined;
  }

  return { field: best.field, score: best.score };
};

const extractNumericValue = (...texts: Array<string | undefined>) => {
  for (const text of texts) {
    const match = text?.replace(/,/g, "").match(valuePattern);
    if (!match) {
      continue;
    }

    const numericValue = Number(match[0]);
    if (Number.isFinite(numericValue)) {
      return {
        value: match[0],
        numericValue,
      };
    }
  }

  return {};
};

const inferUnit = (key: GsproFieldKey, rawText: string) => {
  const explicitUnit = rawText.match(/\b(MPH|RPM|YDS?|FT|DEG|R|L)\b/i)?.[1];
  if (explicitUnit) {
    return explicitUnit.toUpperCase();
  }

  if (key === "ballSpeed") {
    return "MPH";
  }
  if (key === "spin" || key === "backSpin" || key === "sideSpin") {
    return "RPM";
  }
  if (
    key === "vla" ||
    key === "hla" ||
    key === "spinAxis" ||
    key === "descentAngle"
  ) {
    return "DEG";
  }
  if (
    key === "totalDistance" ||
    key === "carryGame" ||
    key === "carryRaw" ||
    key === "offline" ||
    key === "peakHeight"
  ) {
    return "YDS";
  }

  return undefined;
};

const confidenceScore = (text: GsproTileText, labelScore?: number) => {
  const confidences = [
    text.confidence,
    text.valueConfidence,
    text.labelConfidence,
    labelScore === undefined ? undefined : labelScore * 100,
  ].filter((confidence): confidence is number => confidence !== undefined);

  if (confidences.length === 0) {
    return undefined;
  }

  return (
    Math.round(
      (confidences.reduce((sum, confidence) => sum + confidence, 0) /
        confidences.length) *
        100,
    ) / 100
  );
};

const suspiciousValueWarning = (
  key: GsproFieldKey,
  value: number,
): string | undefined => {
  const ranges: Record<GsproFieldKey, { min: number; max: number }> = {
    totalDistance: { min: 0, max: 500 },
    carryGame: { min: 0, max: 500 },
    carryRaw: { min: 0, max: 500 },
    offline: { min: -250, max: 250 },
    ballSpeed: { min: 0, max: 250 },
    vla: { min: -30, max: 80 },
    hla: { min: -90, max: 90 },
    spin: { min: 0, max: 20000 },
    spinAxis: { min: -90, max: 90 },
    peakHeight: { min: 0, max: 250 },
    descentAngle: { min: -90, max: 90 },
    backSpin: { min: -20000, max: 20000 },
    sideSpin: { min: -20000, max: 20000 },
  };
  const range = ranges[key];

  if (value < range.min || value > range.max) {
    return `${key} value ${value} is outside expected range ${range.min}..${range.max}.`;
  }

  return undefined;
};

const buildTile = (
  region: GsproTileRegion,
  text: GsproTileText,
): ParsedTile => {
  const rawText = normalizeWhitespace(text.rawText ?? "");
  const valueText = normalizeWhitespace(text.valueText ?? "");
  const labelText = normalizeWhitespace(text.labelText ?? "");
  const combinedLabelText = [labelText, rawText]
    .filter(Boolean)
    .join(" ")
    .replace(valuePattern, " ");
  const labelMatch = bestLabelMatch(combinedLabelText);
  const parsedValue = extractNumericValue(valueText, rawText);
  const tile: ParsedTile = {
    bounds: region.bounds,
  };

  if (rawText) {
    tile.rawText = rawText;
  }
  if (valueText) {
    tile.valueText = valueText;
  }
  if (labelText) {
    tile.labelText = labelText;
  }
  if (labelMatch) {
    tile.label = labelMatch.field.label;
    tile.key = labelMatch.field.key;
    tile.matchScore = labelMatch.score;
  }
  if (parsedValue.value !== undefined) {
    tile.value = parsedValue.value;
  }
  if (parsedValue.numericValue !== undefined) {
    tile.numericValue = parsedValue.numericValue;
  }
  if (tile.key !== undefined) {
    const unit = inferUnit(tile.key, [rawText, valueText, labelText].join(" "));
    if (unit !== undefined) {
      tile.unit = unit;
    }
  }

  const confidence = confidenceScore(text, labelMatch?.score);
  if (confidence !== undefined) {
    tile.confidence = confidence;
  }

  const warnings: string[] = [];
  if (tile.key !== undefined && tile.numericValue !== undefined) {
    const suspiciousWarning = suspiciousValueWarning(tile.key, tile.numericValue);
    if (suspiciousWarning !== undefined) {
      warnings.push(suspiciousWarning);
    }
  }
  if (
    tile.rawText !== undefined &&
    tile.key === undefined &&
    tile.numericValue !== undefined
  ) {
    warnings.push("OCR found a value but no matching GSPro label.");
  }
  if (
    tile.rawText !== undefined &&
    tile.key !== undefined &&
    tile.numericValue === undefined
  ) {
    warnings.push(`OCR matched ${tile.key} but no numeric value was found.`);
  }
  if (tile.confidence !== undefined && tile.confidence < 55) {
    warnings.push(`Low OCR confidence for tile: ${tile.confidence}.`);
  }
  if (warnings.length > 0) {
    tile.warnings = warnings;
  }

  return tile;
};

const tileCompletenessScore = (tile: ParsedTile) =>
  (tile.key === undefined ? 0 : 1000) +
  (tile.numericValue === undefined ? 0 : 100) +
  (tile.matchScore ?? 0) * 10 +
  (tile.confidence ?? 0);

const mergeDuplicateFields = (tiles: ParsedTile[]) => {
  const bestByKey = new Map<GsproFieldKey, ParsedTile>();

  for (const tile of tiles) {
    if (tile.key === undefined || tile.numericValue === undefined) {
      continue;
    }

    const existing = bestByKey.get(tile.key);
    if (
      existing === undefined ||
      tileCompletenessScore(tile) > tileCompletenessScore(existing)
    ) {
      bestByKey.set(tile.key, tile);
    }
  }

  return Array.from(bestByKey.values()).sort(
    (left, right) => left.bounds.y - right.bounds.y || left.bounds.x - right.bounds.x,
  );
};

const buildFields = (tiles: GsproTileExtraction[]): GsproFields => {
  const fields: GsproFields = {};

  for (const tile of tiles) {
    if (tile.key !== undefined && tile.numericValue !== undefined) {
      fields[tile.key] = tile.numericValue;
    }
  }

  return fields;
};

export const normalizeGsproTiles = (
  imagePath: string,
  regions: GsproTileRegion[],
  tileTexts: GsproTileText[],
  ocrEngine: string,
  warnings: string[],
): GsproCaptureExtraction => {
  const tiles = regions.map((region, index) =>
    buildTile(region, tileTexts[index] ?? {}),
  );
  const normalizedTiles = mergeDuplicateFields(tiles);
  const gsproFields = buildFields(normalizedTiles);
  const normalizedWarnings = [
    ...warnings,
    ...tiles.flatMap((tile) => tile.warnings ?? []),
  ];

  return {
    imagePath,
    ocrRan: tileTexts.some(
      (text) =>
        text.rawText !== undefined ||
        text.valueText !== undefined ||
        text.labelText !== undefined,
    ),
    ocrEngine,
    detectedTileRegionsCount: regions.length,
    tiles,
    normalizedTiles,
    gsproFields,
    missingFields: GS_PRO_FIELD_DEFINITIONS.filter(
      (field) => gsproFields[field.key] === undefined,
    ).map((field) => field.key),
    warnings: Array.from(new Set(normalizedWarnings)),
  };
};
