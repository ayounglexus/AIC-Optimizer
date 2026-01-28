import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Item, ItemId, Recipe } from "@/types";
import { useTranslation } from "react-i18next";
import { getItemName } from "@/lib/i18n-helpers";

type AddTargetDialogGridProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: Item[];
  recipes: Recipe[];
  existingTargetIds: ItemId[];
  onAddTarget: (itemId: ItemId, rate: number) => void;
};

export default function AddTargetDialogGrid({
  open,
  onOpenChange,
  items,
  recipes,
  existingTargetIds,
  onAddTarget,
}: AddTargetDialogGridProps) {
  const { t } = useTranslation("dialog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<ItemId>>(
    new Set()
  );
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Calculate default rate for an item (rate that requires exactly 1 facility)
  const getDefaultRateForItem = (itemId: ItemId): number => {
    // Find recipes that produce this item
    const producingRecipes = recipes.filter(recipe =>
      recipe.outputs.some(output => output.itemId === itemId)
    );

    if (producingRecipes.length === 0) {
      return 10; // Fallback if no recipe found
    }

    // Use the first recipe (primary recipe)
    const recipe = producingRecipes[0];
    const output = recipe.outputs.find(o => o.itemId === itemId);
    
    if (!output) return 10;

    // Calculate production rate per minute for 1 facility
    const ratePerMinute = (output.amount / recipe.craftingTime) * 60;
    
    // Round to 2 decimal places
    return Math.round(ratePerMinute * 100) / 100;
  };

  const availableItems = items.filter(
    (item) => !existingTargetIds.includes(item.id),
  );

  const filteredItems = availableItems.filter((item) => {
    const name = getItemName(item).toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || item.id.toLowerCase().includes(query);
  });

  const handleAddTargets = () => {
    if (selectedItemIds.size > 0) {
      selectedItemIds.forEach((itemId) => {
        const rate = getDefaultRateForItem(itemId);
        onAddTarget(itemId, rate);
      });
      setSelectedItemIds(new Set());
      setLastClickedIndex(null);
      setSearchQuery("");
      onOpenChange(false);
    }
  };

  const handleItemClick = (
    itemId: ItemId,
    index: number,
    event: React.MouseEvent
  ) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+Click: Toggle selection
      setSelectedItemIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
      setLastClickedIndex(index);
    } else if (event.shiftKey && lastClickedIndex !== null) {
      // Shift+Click: Range selection
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      setSelectedItemIds((prev) => {
        const newSet = new Set(prev);
        for (let i = start; i <= end; i++) {
          newSet.add(filteredItems[i].id);
        }
        return newSet;
      });
    } else {
      // Normal click: Single selection
      setSelectedItemIds(new Set([itemId]));
      setLastClickedIndex(index);
    }
  };

  const handleItemDoubleClick = (itemId: ItemId) => {
    const rate = getDefaultRateForItem(itemId);
    onAddTarget(itemId, rate);
    setSelectedItemIds(new Set());
    setLastClickedIndex(null);
    setSearchQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80vw]! h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          {/* Search bar and default rate */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Stable scrollbar gutter prevents layout shift */}
          <div className="flex-1 rounded-md border overflow-auto [scrollbar-gutter:stable]">
            {filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <p className="text-muted-foreground">
                  {availableItems.length === 0
                    ? t("allItemsAdded")
                    : t("noMatchingItems")}
                </p>
              </div>
            ) : (
              <div className="p-3 grid grid-cols-8 xl:grid-cols-10 gap-3">
                {filteredItems.map((item, index) => (
                  <ItemButton
                    key={item.id}
                    item={item}
                    isSelected={selectedItemIds.has(item.id)}
                    onClick={(e) => handleItemClick(item.id, index, e)}
                    onDoubleClick={() => handleItemDoubleClick(item.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer hint and buttons */}
          <div className="flex items-center justify-between pt-3 border-t shrink-0">
            <div className="text-xs text-muted-foreground">
              {selectedItemIds.size > 0 ? (
                <span>
                  {selectedItemIds.size === 1
                    ? t("hint", {
                        selected: getItemName(
                          items.find((i) => i.id === Array.from(selectedItemIds)[0])!,
                        ),
                      })
                    : `${selectedItemIds.size} items selected (Ctrl+Click: toggle, Shift+Click: range)`}
                </span>
              ) : (
                <span>Click to select, Ctrl+Click for multiple, Shift+Click for range, Double-click to add</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={handleAddTargets} disabled={selectedItemIds.size === 0}>
                {selectedItemIds.size > 1
                  ? `Add ${selectedItemIds.size} Items`
                  : t("add")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ItemButtonProps = {
  item: Item;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
};

function ItemButton({
  item,
  isSelected,
  onClick,
  onDoubleClick,
}: ItemButtonProps) {
  const { t } = useTranslation("dialog");

  return (
    <Button
      variant="outline"
      className={`
        relative w-full h-auto p-2
        transition-colors flex flex-col gap-1
        ${
          isSelected
            ? "bg-primary/10 border-primary border-2"
            : "hover:bg-accent active:bg-accent/70"
        }
      `}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={getItemName(item)}
    >
      <div className="aspect-square w-full flex items-center justify-center">
        {item.iconUrl ? (
          <img
            src={item.iconUrl}
            alt={getItemName(item)}
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-muted rounded flex items-center justify-center">
            <span className="text-xs text-muted-foreground">{t("noIcon")}</span>
          </div>
        )}
      </div>
      <div className="text-[10px] text-center line-clamp-2 w-full leading-tight">
        {getItemName(item)}
      </div>
    </Button>
  );
}
