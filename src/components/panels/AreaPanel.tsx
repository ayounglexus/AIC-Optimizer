import { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import TargetItemsGrid, { type ProductionTarget } from "./TargetItemsGrid";
import ProductionStats from "../production/ProductionStats";
import type { Facility, Item } from "@/types";
import type { AreaId } from "@/types/areas";
import { AREA_NAMES } from "@/types/areas";

type AreaPanelProps = {
  areaId: AreaId;
  targets: ProductionTarget[];
  items: Item[];
  facilities: Facility[];
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

const AreaPanel = memo(function AreaPanel({
  areaId,
  targets,
  items,
  facilities,
  totalPowerConsumption,
  productionSteps,
  rawMaterialCount,
  facilityRequirements,
  error,
  isSelected,
  onSelectedChange,
  onTargetChange,
  onTargetRemove,
  onAddClick,
}: AreaPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked: boolean | 'indeterminate') => onSelectedChange(checked === true)}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
            <div
              className="flex items-center gap-2 cursor-pointer flex-1"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <CardTitle className="text-base">{AREA_NAMES[areaId]}</CardTitle>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {targets.length} / 99 targets
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="flex flex-col gap-2.5">
          <TargetItemsGrid
            targets={targets}
            items={items}
            onTargetChange={onTargetChange}
            onTargetRemove={onTargetRemove}
            onAddClick={onAddClick}
          />

          <ProductionStats
            totalPowerConsumption={totalPowerConsumption}
            productionSteps={productionSteps}
            rawMaterialCount={rawMaterialCount}
            facilityRequirements={facilityRequirements}
            facilities={facilities}
            error={error}
          />
        </CardContent>
      )}
    </Card>
  );
});

export default AreaPanel;
