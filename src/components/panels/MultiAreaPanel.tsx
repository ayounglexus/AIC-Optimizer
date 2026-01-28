import { memo } from "react";
import OverallPanel from "./OverallPanel";
import AreaPanel from "./AreaPanel";
import type { Facility, Item } from "@/types";
import type { ProductionTarget } from "./TargetItemsGrid";
import type { AreaId } from "@/types/areas";
import { ALL_AREAS } from "@/types/areas";

type AreaData = {
  targets: ProductionTarget[];
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
};

type MultiAreaPanelProps = {
  items: Item[];
  facilities: Facility[];
  overallData: {
    allTargets: (ProductionTarget & { areaId: AreaId })[];
    totalPowerConsumption: number;
    productionSteps: number;
    rawMaterialCount: number;
    facilityRequirements: Map<string, number>;
    error: string | null;
  };
  areaData: Record<AreaId, AreaData>;
};

const MultiAreaPanel = memo(function MultiAreaPanel({
  items,
  facilities,
  overallData,
  areaData,
}: MultiAreaPanelProps) {
  return (
    <div className="w-[420px] flex flex-col gap-2.5 min-h-0 overflow-y-auto">
      <OverallPanel
        allTargets={overallData.allTargets}
        items={items}
        facilities={facilities}
        totalPowerConsumption={overallData.totalPowerConsumption}
        productionSteps={overallData.productionSteps}
        rawMaterialCount={overallData.rawMaterialCount}
        facilityRequirements={overallData.facilityRequirements}
        error={overallData.error}
      />

      {ALL_AREAS.map((areaId) => {
        const area = areaData[areaId];
        return (
          <AreaPanel
            key={areaId}
            areaId={areaId}
            targets={area.targets}
            items={items}
            facilities={facilities}
            totalPowerConsumption={area.totalPowerConsumption}
            productionSteps={area.productionSteps}
            rawMaterialCount={area.rawMaterialCount}
            facilityRequirements={area.facilityRequirements}
            error={area.error}
            isSelected={area.isSelected}
            onSelectedChange={area.onSelectedChange}
            onTargetChange={area.onTargetChange}
            onTargetRemove={area.onTargetRemove}
            onAddClick={area.onAddClick}
          />
        );
      })}
    </div>
  );
});

export default MultiAreaPanel;
