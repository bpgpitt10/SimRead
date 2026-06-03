export type SimReadMode = "gspro-range-db-first" | "range-db-only";

const truthyEnvValues = new Set(["1", "true", "yes", "on"]);

const isTruthyEnvValue = (value: string | undefined) =>
  value !== undefined && truthyEnvValues.has(value.trim().toLowerCase());

export const resolveSimReadMode = (): SimReadMode => {
  if (
    process.env.SIMREAD_SOURCE === "range-db-only" ||
    isTruthyEnvValue(process.env.SIMREAD_DISABLE_OCR_FALLBACK)
  ) {
    return "range-db-only";
  }

  return "gspro-range-db-first";
};

export const isOcrFallbackEnabled = (mode: SimReadMode) =>
  mode !== "range-db-only";
