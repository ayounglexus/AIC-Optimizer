import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProductionStats from "../production/ProductionStats";
import type { Facility, Item } from "@/types";
import type { ProductionTarget } from "./TargetItemsGrid";
import type { AreaId } from "@/types/areas";
import { useTranslation } from "react-i18next";

type OverallPanelProps = {
  allTargets: (ProductionTarget & { areaId: AreaId })[];
  items: Item[];
  facilities: Facility[];
  totalPowerConsumption: number;
  productionSteps: number;
  rawMaterialCount: number;
  facilityRequirements: Map<string, number>;
  error: string | null;
};

const OverallPanel = memo(function OverallPanel({
  allTargets,
  items,
  facilities,
  totalPowerConsumption,
  productionSteps,
  rawMaterialCount,
  facilityRequirements,
  error,
}: OverallPanelProps) {
  const { t } = useTranslation("item");

  return (
    <div className="flex flex-col gap-2.5">
      <Card className="shrink-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Overall Production Targets</CardTitle>
            <div className="text-xs text-muted-foreground">
              {allTargets.length} targets across all areas
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2">
            {allTargets.map((target, index) => {
              const item = items.find((i) => i.id === target.itemId);
              if (!item) return null;

              return (
                <div
                  key={`${target.areaId}-${target.itemId}-${index}`}
                  className="flex flex-col items-center gap-1"
                >
                  <img
                    src={item.iconUrl}
                    alt={t(item.id)}
                    className="w-12 h-12 object-contain bg-muted rounded"
                  />
                  <div className="text-xs text-center text-muted-foreground truncate w-full px-1">
                    {t(item.id)}
                  </div>
                  <div className="text-xs font-medium">{target.rate}/min</div>
                  <div className="text-[10px] text-muted-foreground">
                    {target.areaId}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ProductionStats
        totalPowerConsumption={totalPowerConsumption}
        productionSteps={productionSteps}
        rawMaterialCount={rawMaterialCount}
        facilityRequirements={facilityRequirements}
        facilities={facilities}
        error={error}
      />
    </div>
  );
});

export default OverallPanel;
