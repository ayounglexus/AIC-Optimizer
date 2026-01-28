// Factory area types and constants

export enum AreaId {
  CORE_AIC = "core-aic",
  REFUGEE_CAMP = "refugee-camp",
  INFRA_STATION = "infra-station",
  RECONSTRUCTION_HQ = "reconstruction-hq",
}

export const AREA_NAMES: Record<AreaId, string> = {
  [AreaId.CORE_AIC]: "Core AIC",
  [AreaId.REFUGEE_CAMP]: "Refugee Camp",
  [AreaId.INFRA_STATION]: "Infra-Station",
  [AreaId.RECONSTRUCTION_HQ]: "Reconstruction HQ",
};

export const ALL_AREAS = [
  AreaId.CORE_AIC,
  AreaId.REFUGEE_CAMP,
  AreaId.INFRA_STATION,
  AreaId.RECONSTRUCTION_HQ,
] as const;
