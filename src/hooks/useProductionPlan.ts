import { calculateProductionPlan } from "@/lib/calculator";
import { items, recipes, facilities } from "@/data";
import { useState, useMemo, useCallback, useEffect } from "react";
import type { ProductionTarget } from "@/components/panels/TargetItemsGrid";
import type { ItemId, RecipeId } from "@/types";
import { useTranslation } from "react-i18next";
import { useProductionStats } from "./useProductionStats";
import { useProductionTable } from "./useProductionTable";
import { AreaId, ALL_AREAS } from "@/types/areas";

// Per-area state structure
export type AreaState = {
  targets: ProductionTarget[];
  recipeOverrides: Map<ItemId, RecipeId>;
  manualRawMaterials: Set<ItemId>;
};

// All areas state
export type AreasState = Record<AreaId, AreaState>;

// LocalStorage keys
const STORAGE_KEY = "productionAreasState";

// Create empty area state
function createEmptyAreaState(): AreaState {
  return {
    targets: [],
    recipeOverrides: new Map<ItemId, RecipeId>(),
    manualRawMaterials: new Set<ItemId>(),
  };
}

// Load saved state from localStorage
function loadSavedState(): AreasState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const result: AreasState = {} as AreasState;
      
      for (const areaId of ALL_AREAS) {
        const areaData = parsed[areaId];
        if (areaData) {
          result[areaId] = {
            targets: areaData.targets || [],
            recipeOverrides: new Map(areaData.recipeOverrides || []),
            manualRawMaterials: new Set(areaData.manualRawMaterials || []),
          };
        } else {
          result[areaId] = createEmptyAreaState();
        }
      }
      return result;
    }
  } catch (error) {
    console.error("Failed to load saved state:", error);
  }

  // Return default empty state for all areas
  const defaultState: AreasState = {} as AreasState;
  for (const areaId of ALL_AREAS) {
    defaultState[areaId] = createEmptyAreaState();
  }
  return defaultState;
}

// Save state to localStorage
function saveState(state: AreasState) {
  try {
    const serializable: any = {};
    for (const areaId of ALL_AREAS) {
      serializable[areaId] = {
        targets: state[areaId].targets,
        recipeOverrides: Array.from(state[areaId].recipeOverrides.entries()),
        manualRawMaterials: Array.from(state[areaId].manualRawMaterials),
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error("Failed to save state:", error);
  }
}

export function useProductionPlan() {
  const { t } = useTranslation("app");

  // Initialize state from localStorage
  const [areasState, setAreasState] = useState<AreasState>(loadSavedState);
  const [dialogOpenForArea, setDialogOpenForArea] = useState<AreaId | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "tree">("table");

  // Auto-save to localStorage whenever state changes
  useEffect(() => {
    saveState(areasState);
  }, [areasState]);

  // Calculate production plan for each area
  const areaPlans = useMemo(() => {
    const plans: Record<AreaId, { plan: any; error: string | null }> = {} as any;
    
    for (const areaId of ALL_AREAS) {
      const areaState = areasState[areaId];
      let plan = null;
      let error: string | null = null;

      try {
        if (areaState.targets.length > 0) {
          plan = calculateProductionPlan(
            areaState.targets,
            items,
            recipes,
            facilities,
            areaState.recipeOverrides,
            areaState.manualRawMaterials,
          );
        }
      } catch (e) {
        error = e instanceof Error ? e.message : t("calculationError");
      }

      plans[areaId] = { plan, error };
    }

    return plans;
  }, [areasState, t]);

  // Calculate stats for each area - call hooks directly for each area
  const coreAicStats = useProductionStats(
    areaPlans["core-aic"].plan,
    areasState["core-aic"].manualRawMaterials
  );
  const refugeeCampStats = useProductionStats(
    areaPlans["refugee-camp"].plan,
    areasState["refugee-camp"].manualRawMaterials
  );
  const infraStationStats = useProductionStats(
    areaPlans["infra-station"].plan,
    areasState["infra-station"].manualRawMaterials
  );
  const reconstructionHqStats = useProductionStats(
    areaPlans["reconstruction-hq"].plan,
    areasState["reconstruction-hq"].manualRawMaterials
  );

  const areaStats = useMemo(() => ({
    "core-aic": coreAicStats,
    "refugee-camp": refugeeCampStats,
    "infra-station": infraStationStats,
    "reconstruction-hq": reconstructionHqStats,
  }), [coreAicStats, refugeeCampStats, infraStationStats, reconstructionHqStats]);

  // Calculate table data for each area - call hooks directly for each area
  const coreAicTableData = useProductionTable(
    areaPlans["core-aic"].plan,
    recipes,
    areasState["core-aic"].recipeOverrides,
    areasState["core-aic"].manualRawMaterials
  );
  const refugeeCampTableData = useProductionTable(
    areaPlans["refugee-camp"].plan,
    recipes,
    areasState["refugee-camp"].recipeOverrides,
    areasState["refugee-camp"].manualRawMaterials
  );
  const infraStationTableData = useProductionTable(
    areaPlans["infra-station"].plan,
    recipes,
    areasState["infra-station"].recipeOverrides,
    areasState["infra-station"].manualRawMaterials
  );
  const reconstructionHqTableData = useProductionTable(
    areaPlans["reconstruction-hq"].plan,
    recipes,
    areasState["reconstruction-hq"].recipeOverrides,
    areasState["reconstruction-hq"].manualRawMaterials
  );

  const areaTableData = useMemo(() => ({
    "core-aic": coreAicTableData,
    "refugee-camp": refugeeCampTableData,
    "infra-station": infraStationTableData,
    "reconstruction-hq": reconstructionHqTableData,
  }), [coreAicTableData, refugeeCampTableData, infraStationTableData, reconstructionHqTableData]);

  // Calculate overall stats by combining stats from all areas
  const overallStats = useMemo(() => {
    const combinedStats = {
      totalPowerConsumption: 0,
      rawMaterialRequirements: new Map<ItemId, number>(),
      uniqueProductionSteps: 0,
      facilityRequirements: new Map<string, number>(),
    };

    ALL_AREAS.forEach(areaId => {
      const stats = areaStats[areaId];
      combinedStats.totalPowerConsumption += stats.totalPowerConsumption;
      combinedStats.uniqueProductionSteps += stats.uniqueProductionSteps;

      // Combine raw materials
      stats.rawMaterialRequirements.forEach((amount, itemId) => {
        combinedStats.rawMaterialRequirements.set(
          itemId,
          (combinedStats.rawMaterialRequirements.get(itemId) || 0) + amount
        );
      });

      // Combine facilities
      stats.facilityRequirements.forEach((count, facilityId) => {
        combinedStats.facilityRequirements.set(
          facilityId,
          (combinedStats.facilityRequirements.get(facilityId) || 0) + count
        );
      });
    });

    return combinedStats;
  }, [areaStats]);

  // Overall plan is null - we only use overall stats
  const overallPlan = null;

  // Handler functions for per-area operations
  const handleTargetChange = useCallback((areaId: AreaId, index: number, rate: number) => {
    setAreasState((prev) => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        targets: prev[areaId].targets.map((t, i) =>
          i === index ? { ...t, rate } : t
        ),
      },
    }));
  }, []);

  const handleTargetRemove = useCallback((areaId: AreaId, index: number) => {
    setAreasState((prev) => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        targets: prev[areaId].targets.filter((_, i) => i !== index),
      },
    }));
  }, []);

  const handleAddTarget = useCallback((areaId: AreaId, itemId: ItemId, rate: number) => {
    setAreasState((prev) => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        targets: [...prev[areaId].targets, { itemId, rate }],
      },
    }));
  }, []);

  const handleRecipeChange = useCallback(
    (areaId: AreaId, itemId: ItemId, recipeId: RecipeId) => {
      setAreasState((prev) => {
        const newOverrides = new Map(prev[areaId].recipeOverrides);
        newOverrides.set(itemId, recipeId);
        return {
          ...prev,
          [areaId]: {
            ...prev[areaId],
            recipeOverrides: newOverrides,
          },
        };
      });
    },
    [],
  );

  const handleAddClick = useCallback((areaId: AreaId) => {
    setDialogOpenForArea(areaId);
  }, []);

  const handleToggleRawMaterial = useCallback((areaId: AreaId, itemId: ItemId) => {
    setAreasState((prev) => {
      const newRawMaterials = new Set(prev[areaId].manualRawMaterials);
      if (newRawMaterials.has(itemId)) {
        newRawMaterials.delete(itemId);
      } else {
        newRawMaterials.add(itemId);
      }
      return {
        ...prev,
        [areaId]: {
          ...prev[areaId],
          manualRawMaterials: newRawMaterials,
        },
      };
    });
  }, []);

  return {
    areasState,
    areaPlans,
    areaStats,
    areaTableData,
    overallPlan,
    overallStats,
    dialogOpenForArea,
    setDialogOpenForArea,
    activeTab,
    setActiveTab,
    handleTargetChange,
    handleTargetRemove,
    handleAddTarget,
    handleToggleRawMaterial,
    handleRecipeChange,
    handleAddClick,
  };
}
