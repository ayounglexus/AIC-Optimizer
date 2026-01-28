// Factory area types and constants

export type AreaId =
  | "core-aic"
  | "refugee-camp"
  | "infra-station"
  | "reconstruction-hq";

export const AreaId = {
  CORE_AIC: "core-aic" as AreaId,
  REFUGEE_CAMP: "refugee-camp" as AreaId,
  INFRA_STATION: "infra-station" as AreaId,
  RECONSTRUCTION_HQ: "reconstruction-hq" as AreaId,
} as const;

export const AREA_NAMES: Record<AreaId, string> = {
  "core-aic": "Core AIC",
  "refugee-camp": "Refugee Camp",
  "infra-station": "Infra-Station",
  "reconstruction-hq": "Reconstruction HQ",
};

export const ALL_AREAS: readonly AreaId[] = [
  "core-aic",
  "refugee-camp",
  "infra-station",
  "reconstruction-hq",
] as const;
