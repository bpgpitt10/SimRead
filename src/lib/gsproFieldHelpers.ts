import {
  GS_PRO_CORE_KEYS,
  GS_PRO_FIELD_KEYS,
  GS_PRO_OGC_RELEVANT_KEYS,
} from "../config/gsproFieldRegistry";

export type GsproVisibilityComputation = {
  visibleFields: string[];
  missingVisibleFields: string[];
  completenessScore: number;
};

export type OgcEligibilityComputation = {
  callable: boolean;
  recommended: boolean;
  presentFields: string[];
  missingFields: string[];
};

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

export const computeGsproVisibility = (
  visibleFields: string[],
): GsproVisibilityComputation => {
  const dedupedVisibleFields = Array.from(new Set(visibleFields));
  const visibleFieldSet = new Set(dedupedVisibleFields);

  return {
    visibleFields: dedupedVisibleFields,
    missingVisibleFields: GS_PRO_FIELD_KEYS.filter((key) => !visibleFieldSet.has(key)),
    completenessScore: roundToTwoDecimals(
      dedupedVisibleFields.length / GS_PRO_CORE_KEYS.length,
    ),
  };
};

export const computeOgcEligibility = (
  visibleFields: string[],
): OgcEligibilityComputation => {
  const visibleFieldSet = new Set(visibleFields);
  const presentFields = GS_PRO_OGC_RELEVANT_KEYS.filter((key) =>
    visibleFieldSet.has(key),
  );

  return {
    callable: presentFields.length >= 1,
    recommended: presentFields.length >= 4,
    presentFields,
    missingFields: GS_PRO_OGC_RELEVANT_KEYS.filter((key) => !visibleFieldSet.has(key)),
  };
};
