import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/contexts/SettingsContext";

import { items, facilities, recipes } from "./data";
import { useProductionPlan } from "./hooks/useProductionPlan";
import AppHeader from "./components/layout/AppHeader";
import MultiAreaPanel from "./components/panels/MultiAreaPanel";
import ProductionViewTabs from "./components/production/ProductionViewTabs";
import AddTargetDialogGrid from "./components/panels/AddTargetDialogGrid";
import AppFooter from "./components/layout/AppFooter";
import { ALL_AREAS, type AreaId } from "./types/areas";
import type { ItemId } from "./types";

export default function App() {
  const { i18n } = useTranslation("app");
  const [selectedAreas, setSelectedAreas] = useState<Set<AreaId>>(new Set());

  const {
    areasState,
    areaPlans,
    areaStats,
    areaTableData,
    dialogOpenForArea,
    activeTab,
    overallStats,
    handleTargetChange,
    handleTargetRemove,
    handleAddTarget,
    handleToggleRawMaterial,
    handleRecipeChange,
    handleAddClick,
    setDialogOpenForArea,
    setActiveTab,
  } = useProductionPlan();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  // Combine all targets from all areas for overall view
  const allTargets = ALL_AREAS.flatMap((areaId) =>
    areasState[areaId].targets.map((target) => ({ ...target, areaId }))
  );

  // Prepare area data for MultiAreaPanel
  const areaData = ALL_AREAS.reduce(
    (acc, areaId) => {
      const planData = areaPlans[areaId];
      const stats = areaStats[areaId];

      acc[areaId] = {
        targets: areasState[areaId].targets,
        totalPowerConsumption: stats.totalPowerConsumption,
        productionSteps: stats.uniqueProductionSteps,
        rawMaterialCount: stats.rawMaterialRequirements.size,
        facilityRequirements: stats.facilityRequirements,
        error: planData.error,
        isSelected: selectedAreas.has(areaId),
        onSelectedChange: (selected: boolean) => {
          setSelectedAreas((prev) => {
            const newSet = new Set(prev);
            if (selected) {
              newSet.add(areaId);
            } else {
              newSet.delete(areaId);
            }
            return newSet;
          });
        },
        onTargetChange: (index: number, rate: number) =>
          handleTargetChange(areaId, index, rate),
        onTargetRemove: (index: number) => handleTargetRemove(areaId, index),
        onAddClick: () => handleAddClick(areaId),
      };
      return acc;
    },
    {} as Record<
      AreaId,
      {
        targets: any[];
        totalPowerConsumption: number;
        productionSteps: number;
        rawMaterialCount: number;
        facilityRequirements: Map<string, number>;
        error: string | null;
        isSelected: boolean;
        onSelectedChange: (selected: boolean) => void;
        onTargetChange: (index: number, rate: number) => void;
        onTargetRemove: (index: number) => void;
        onAddClick: () => void;
      }
    >
  );

  // Overall data
  const overallData = {
    allTargets,
    totalPowerConsumption: overallStats.totalPowerConsumption,
    productionSteps: overallStats.uniqueProductionSteps,
    rawMaterialCount: overallStats.rawMaterialRequirements.size,
    facilityRequirements: overallStats.facilityRequirements,
    error: null, // Overall doesn't have errors, individual areas do
  };

  // Determine which areas to show (if none selected, show all)
  const areasToShow = selectedAreas.size > 0 ? Array.from(selectedAreas) : ALL_AREAS;

  // Combine plans from all selected areas
  const combinedPlan = useMemo(() => {
    const plansToMerge = areasToShow
      .map(areaId => areaPlans[areaId]?.plan)
      .filter(Boolean);

    if (plansToMerge.length === 0) return null;
    if (plansToMerge.length === 1) return plansToMerge[0];

    // Merge multiple plans into one
    const mergedNodes = new Map();
    const mergedEdges: Array<{ from: string; to: string }> = [];
    const mergedTargets = new Set<ItemId>();
    const mergedCycles: any[] = [];

    plansToMerge.forEach((plan: any) => {
      if (!plan) return;
      
      // Merge nodes
      plan.nodes.forEach((node: any, key: string) => {
        if (mergedNodes.has(key)) {
          // If node exists, aggregate quantities
          const existing = mergedNodes.get(key);
          if (existing.type === 'item' && node.type === 'item') {
            existing.productionRate += node.productionRate;
          } else if (existing.type === 'recipe' && node.type === 'recipe') {
            existing.facilityCount += node.facilityCount;
          }
        } else {
          mergedNodes.set(key, { ...node });
        }
      });

      // Merge edges
      mergedEdges.push(...plan.edges);

      // Merge targets
      plan.targets.forEach((target: ItemId) => mergedTargets.add(target));

      // Merge cycles
      if (plan.detectedCycles) {
        mergedCycles.push(...plan.detectedCycles);
      }
    });

    return {
      nodes: mergedNodes,
      edges: mergedEdges,
      targets: mergedTargets,
      detectedCycles: mergedCycles,
    };
  }, [areasToShow, areaPlans]);

  const combinedTableData = useMemo(() => {
    // Collect all table data from selected areas
    const allData = areasToShow.flatMap(areaId => {
      const data = areaTableData[areaId] || [];
      return data.map(row => ({ ...row, areaId }));
    });

    if (areasToShow.length === 1) {
      return allData; // No aggregation needed for single area
    }

    // Aggregate data by itemId
    const aggregatedMap = new Map<ItemId, any>();

    allData.forEach((row: any) => {
      const itemId = row.item.id;
      
      if (aggregatedMap.has(itemId)) {
        const existing = aggregatedMap.get(itemId);
        // Add up rates and facility counts
        existing.outputRate += row.outputRate;
        existing.facilityCount += row.facilityCount;
        
        // Merge dependencies
        if (row.directDependencyItemIds) {
          row.directDependencyItemIds.forEach((dep: ItemId) => 
            existing.directDependencyItemIds.add(dep)
          );
        }
      } else {
        // First occurrence - create a copy with Set for dependencies
        aggregatedMap.set(itemId, {
          ...row,
          directDependencyItemIds: row.directDependencyItemIds 
            ? new Set(row.directDependencyItemIds) 
            : new Set(),
        });
      }
    });

    return Array.from(aggregatedMap.values());
  }, [areasToShow, areaTableData]);

  // Get dialog area - when opening dialog, default to first selected area or Core AIC
  const dialogAreaId = dialogOpenForArea || (selectedAreas.size > 0 ? Array.from(selectedAreas)[0] : ALL_AREAS[0]);
  const currentExistingTargetIds = areasState[dialogAreaId]?.targets.map(
    (t) => t.itemId
  ) || [];

  return (
    <SettingsProvider>
      <TooltipProvider>
        <div className="h-screen flex flex-col p-4 pb-0 gap-4">
          <AppHeader onLanguageChange={handleLanguageChange} />

          <div className="flex-1 flex gap-4 min-h-0">
            <MultiAreaPanel
              items={items}
              facilities={facilities}
              overallData={overallData}
              areaData={areaData}
            />

            <ProductionViewTabs
              plan={combinedPlan}
              tableData={combinedTableData}
              items={items}
              facilities={facilities}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onRecipeChange={(itemId, recipeId) => {
                // Apply recipe change to all selected areas
                areasToShow.forEach(areaId => handleRecipeChange(areaId, itemId, recipeId));
              }}
              onToggleRawMaterial={(itemId) => {
                // Apply raw material toggle to all selected areas
                areasToShow.forEach(areaId => handleToggleRawMaterial(areaId, itemId));
              }}
            />
          </div>

          <AddTargetDialogGrid
            open={dialogOpenForArea !== null}
            onOpenChange={(open) => setDialogOpenForArea(open ? dialogAreaId : null)}
            items={items}
            recipes={recipes}
            existingTargetIds={currentExistingTargetIds}
            onAddTarget={(itemId, rate) => handleAddTarget(dialogAreaId, itemId, rate)}
          />

          <AppFooter />
        </div>
      </TooltipProvider>
    </SettingsProvider>
  );
}
