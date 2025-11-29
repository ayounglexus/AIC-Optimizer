import { ItemId, RecipeId, FacilityId } from "./constants";
const Language = {
  EN: "en",
  ZH_CN: "zh-CN",
  ZH_TW: "zh-TW",
} as const;
type Language = (typeof Language)[keyof typeof Language];
type Translations = Partial<Record<Language, string>>;

type Item = {
  id: ItemId;
  name: Translations;
  iconUrl?: string;
  tier: number;
};

type RecipeItem = {
  itemId: ItemId;
  amount: number;
};

type Recipe = {
  id: RecipeId;
  inputs: RecipeItem[];
  outputs: RecipeItem[];
  facilityId: FacilityId;
  craftingTime: number;
};

type Facility = {
  id: FacilityId;
  name: Translations;
  powerConsumption: number;
  supportedRecipes: RecipeId[];
  iconUrl?: string;
  tier: number;
};

export { Language };

export type {
  Item,
  Recipe,
  RecipeItem,
  Facility,
  Language as LanguageType,
  Translations,
};

export type { ItemId, RecipeId, FacilityId } from "./constants";
