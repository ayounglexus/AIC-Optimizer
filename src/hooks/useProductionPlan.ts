import { calculateProductionPlan } from "@/lib/calculator";
import { items, recipes, facilities } from "@/data";
import { useState, useMemo, useCallback, useEffect } from "react";
import type { ProductionTarget } from "@/components/panels/TargetItemsGrid";
import type { ItemId, RecipeId } from "@/types";
import { useTranslation } from "react-i18next";
import { useProductionStats } from "./useProductionStats";
import { useProductionTable } from "./useProductionTable";

// LocalStorage keys
const STORAGE_KEYS = {
  TARGETS: "productionTargets",
  RECIPE_OVERRIDES: "recipeOverrides",
  MANUAL_RAW_MATERIALS: "manualRawMaterials",
};

// Load saved state from localStorage
function loadSavedState() {
  try {
    const savedTargets = localStorage.getItem(STORAGE_KEYS.TARGETS);
    const savedRecipes = localStorage.getItem(STORAGE_KEYS.RECIPE_OVERRIDES);
    const savedRawMaterials = localStorage.getItem(
      STORAGE_KEYS.MANUAL_RAW_MATERIALS
    );

    return {
      targets: savedTargets ? JSON.parse(savedTargets) : [],
      recipeOverrides: savedRecipes
        ? new Map(JSON.parse(savedRecipes))
        : new Map(),
      manualRawMaterials: savedRawMaterials
        ? new Set(JSON.parse(savedRawMaterials))
        : new Set(),
    };
  } catch (error) {
    console.error("Failed to load saved state:", error);
    return {
      targets: [],
      recipeOverrides: new Map(),
      manualRawMaterials: new Set(),
    };
  }
}

export function useProductionPlan() {
  const { t } = useTranslation("app");

  // Initialize state from localStorage
  const [targets, setTargets] = useState<ProductionTarget[]>(() =>
    loadSavedState().targets
  );
  const [recipeOverrides, setRecipeOverrides] = useState<Map<ItemId, RecipeId>>(
    () => loadSavedState().recipeOverrides
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"table" | "tree">("table");
  const [manualRawMaterials, setManualRawMaterials] = useState<Set<ItemId>>(
    () => loadSavedState().manualRawMaterials
  );

  // Auto-save targets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(targets));
    } catch (error) {
      console.error("Failed to save targets:", error);
    }
  }, [targets]);

  // Auto-save recipe overrides to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.RECIPE_OVERRIDES,
        JSON.stringify(Array.from(recipeOverrides.entries()))
      );
    } catch (error) {
      console.error("Failed to save recipe overrides:", error);
    }
  }, [recipeOverrides]);

  // Auto-save manual raw materials to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.MANUAL_RAW_MATERIALS,
        JSON.stringify(Array.from(manualRawMaterials))
      );
    } catch (error) {
      console.error("Failed to save manual raw materials:", error);
    }
  }, [manualRawMaterials]);

  // Core calculation: only returns dependency tree and cycles
  const { plan, error } = useMemo(() => {
    let plan = null;
    let error: string | null = null;

    try {
      if (targets.length > 0) {
        plan = calculateProductionPlan(
          targets,
          items,
          recipes,
          facilities,
          recipeOverrides,
          manualRawMaterials,
        );
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t("calculationError");
    }

    return { plan, error };
  }, [targets, recipeOverrides, manualRawMaterials, t]);

  // View-specific data: computed in view layer hooks
  const stats = useProductionStats(plan, manualRawMaterials);
  const tableData = useProductionTable(
    plan,
    recipes,
    recipeOverrides,
    manualRawMaterials,
  );

  const handleTargetChange = useCallback((index: number, rate: number) => {
    setTargets((prev) => {
      const newTargets = [...prev];
      newTargets[index].rate = rate;
      return newTargets;
    });
  }, []);

  const handleTargetRemove = useCallback((index: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddTarget = useCallback((itemId: ItemId, rate: number) => {
    setTargets((prev) => [...prev, { itemId, rate }]);
  }, []);

  const handleRecipeChange = useCallback(
    (itemId: ItemId, recipeId: RecipeId) => {
      setRecipeOverrides((prev) => {
        const newMap = new Map(prev);
        newMap.set(itemId, recipeId);
        return newMap;
      });
    },
    [],
  );

  const handleAddClick = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleToggleRawMaterial = useCallback((itemId: ItemId) => {
    setManualRawMaterials((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  return {
    targets,
    setTargets,
    recipeOverrides,
    setRecipeOverrides,
    dialogOpen,
    setDialogOpen,
    activeTab,
    setActiveTab,
    plan,
    tableData,
    stats,
    error,
    handleTargetChange,
    handleTargetRemove,
    handleAddTarget,
    handleToggleRawMaterial,
    handleRecipeChange,
    handleAddClick,
  };
}
