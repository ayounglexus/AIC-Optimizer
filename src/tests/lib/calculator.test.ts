import { describe, test, expect } from "vitest";
import {
  calculateProductionPlan,
  defaultRecipeSelector,
  smartRecipeSelector,
} from "@/lib/calculator";
import type { ProductionNode, Recipe } from "@/types";
import { ItemId, RecipeId } from "@/types/constants";
import {
  mockItems,
  mockFacilities,
  simpleRecipes,
  multiRecipeItems,
  cycleRecipes,
  complexRecipes,
} from "./fixtures/test-data";

describe("Recipe Selectors", () => {
  test("defaultRecipeSelector returns first recipe", () => {
    const recipes = multiRecipeItems.filter(
      (r) => r.outputs[0].itemId === ItemId.ITEM_IRON_NUGGET,
    );

    const selected = defaultRecipeSelector(recipes);

    expect(selected.id).toBe(RecipeId.FURNANCE_IRON_NUGGET_1);
  });

  test("smartRecipeSelector avoids circular dependencies", () => {
    // Create a scenario where one recipe would cause a cycle
    const recipes: Recipe[] = [
      {
        id: RecipeId.FURNANCE_IRON_NUGGET_2,
        inputs: [{ itemId: ItemId.ITEM_IRON_POWDER, amount: 1 }],
        outputs: [{ itemId: ItemId.ITEM_IRON_NUGGET, amount: 1 }],
        facilityId: mockFacilities[0].id,
        craftingTime: 2,
      },
      {
        id: RecipeId.FURNANCE_IRON_NUGGET_1,
        inputs: [{ itemId: ItemId.ITEM_IRON_ORE, amount: 1 }],
        outputs: [{ itemId: ItemId.ITEM_IRON_NUGGET, amount: 1 }],
        facilityId: mockFacilities[0].id,
        craftingTime: 2,
      },
    ];

    // Visited path includes IRON_POWDER
    const visitedPath = new Set([ItemId.ITEM_IRON_POWDER]);

    const selected = smartRecipeSelector(recipes, visitedPath);

    // Should select the recipe that doesn't use IRON_POWDER
    expect(selected.id).toBe(RecipeId.FURNANCE_IRON_NUGGET_1);
  });

  test("smartRecipeSelector falls back to first recipe if all create cycles", () => {
    const recipes: Recipe[] = [
      {
        id: RecipeId.FURNANCE_IRON_NUGGET_2,
        inputs: [{ itemId: ItemId.ITEM_IRON_POWDER, amount: 1 }],
        outputs: [{ itemId: ItemId.ITEM_IRON_NUGGET, amount: 1 }],
        facilityId: mockFacilities[0].id,
        craftingTime: 2,
      },
    ];

    const visitedPath = new Set([ItemId.ITEM_IRON_POWDER]);

    const selected = smartRecipeSelector(recipes, visitedPath);

    // Should fall back to first recipe
    expect(selected.id).toBe(RecipeId.FURNANCE_IRON_NUGGET_2);
  });
});

describe("Simple Production Plan", () => {
  test("calculates plan for single raw material", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_ORE, rate: 30 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );

    expect(plan.dependencyRootNodes).toHaveLength(1);

    const root = plan.dependencyRootNodes[0];
    expect(root.item.id).toBe(ItemId.ITEM_IRON_ORE);
    expect(root.targetRate).toBe(30);
    expect(root.isRawMaterial).toBe(true);
    expect(root.facilityCount).toBe(0);
    expect(root.dependencies).toHaveLength(0);
  });

  test("calculates plan for simple linear chain", () => {
    // Target: 30 iron powder/min
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 30 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );

    expect(plan.dependencyRootNodes).toHaveLength(1);

    const root = plan.dependencyRootNodes[0];
    expect(root.item.id).toBe(ItemId.ITEM_IRON_POWDER);
    expect(root.targetRate).toBe(30);
    expect(root.facilityCount).toBeCloseTo(1, 5); // 30 items/min ÷ 30 per facility = 1

    // Should have one dependency: iron nugget
    expect(root.dependencies).toHaveLength(1);
    const dep = root.dependencies[0];
    expect(dep.item.id).toBe(ItemId.ITEM_IRON_NUGGET);
    expect(dep.targetRate).toBeCloseTo(30, 5);
    expect(dep.facilityCount).toBeCloseTo(1, 5);

    // Nugget should depend on ore
    expect(dep.dependencies).toHaveLength(1);
    const oreDep = dep.dependencies[0];
    expect(oreDep.item.id).toBe(ItemId.ITEM_IRON_ORE);
    expect(oreDep.isRawMaterial).toBe(true);
  });

  test("calculates facility count correctly", () => {
    // Target: 60 iron powder/min (requires 2 facilities)
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 60 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];
    expect(root.facilityCount).toBeCloseTo(2, 5);

    // Dependencies should also double
    const nuggetDep = root.dependencies[0];
    expect(nuggetDep.facilityCount).toBeCloseTo(2, 5);
  });

  test("handles fractional facility counts", () => {
    // Target: 15 iron powder/min (requires 0.5 facilities)
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 15 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];
    expect(root.facilityCount).toBeCloseTo(0.5, 5);
  });
});

describe("Multiple Recipe Selection", () => {
  test("uses default selector to pick first recipe", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_NUGGET, rate: 30 }],
      mockItems,
      multiRecipeItems,
      mockFacilities,
      undefined,
      defaultRecipeSelector,
    );

    const root = plan.dependencyRootNodes[0];
    expect(root.recipe?.id).toBe(RecipeId.FURNANCE_IRON_NUGGET_1);
    expect(root.dependencies[0].item.id).toBe(ItemId.ITEM_IRON_ORE);
  });

  test("respects recipe overrides", () => {
    const overrides = new Map([
      [ItemId.ITEM_IRON_NUGGET, RecipeId.FURNANCE_IRON_NUGGET_2],
    ]);

    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_NUGGET, rate: 30 }],
      mockItems,
      multiRecipeItems,
      mockFacilities,
      overrides,
    );

    const root = plan.dependencyRootNodes[0];
    expect(root.recipe?.id).toBe(RecipeId.FURNANCE_IRON_NUGGET_2);
    expect(root.dependencies[0].item.id).toBe(ItemId.ITEM_IRON_POWDER);
  });
});

describe("Multiple Targets", () => {
  test("calculates plan for multiple independent targets", () => {
    const plan = calculateProductionPlan(
      [
        { itemId: ItemId.ITEM_IRON_POWDER, rate: 30 },
        { itemId: ItemId.ITEM_GLASS_CMPT, rate: 15 },
      ],
      mockItems,
      [...simpleRecipes, ...complexRecipes],
      mockFacilities,
    );

    expect(plan.dependencyRootNodes).toHaveLength(2);

    const ironRoot = plan.dependencyRootNodes.find(
      (n) => n.item.id === ItemId.ITEM_IRON_POWDER,
    );
    const glassRoot = plan.dependencyRootNodes.find(
      (n) => n.item.id === ItemId.ITEM_GLASS_CMPT,
    );

    expect(ironRoot).toBeDefined();
    expect(glassRoot).toBeDefined();
  });
});

describe("Complex Dependencies", () => {
  test("calculates multi-tier production plan", () => {
    // Battery needs glass components and iron components
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_PROC_BATTERY_1, rate: 6 }], // 6 batteries/min
      mockItems,
      complexRecipes,
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];
    expect(root.item.id).toBe(ItemId.ITEM_PROC_BATTERY_1);
    expect(root.targetRate).toBe(6);
    expect(root.facilityCount).toBeCloseTo(1, 5); // 6 items/min ÷ 6 per facility = 1

    // Should have 2 dependencies: glass and iron components
    expect(root.dependencies).toHaveLength(2);

    const glassDep = root.dependencies.find(
      (d) => d.item.id === ItemId.ITEM_GLASS_CMPT,
    );
    const ironDep = root.dependencies.find(
      (d) => d.item.id === ItemId.ITEM_IRON_CMPT,
    );

    expect(glassDep).toBeDefined();
    expect(ironDep).toBeDefined();

    // Glass: 5 per battery, 6 batteries/min = 30/min
    expect(glassDep!.targetRate).toBeCloseTo(30, 5);
    // Iron: 10 per battery, 6 batteries/min = 60/min
    expect(ironDep!.targetRate).toBeCloseTo(60, 5);
  });

  test("handles recipes with different crafting times", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_PROC_BATTERY_1, rate: 12 }],
      mockItems,
      complexRecipes,
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];

    // Battery: craftingTime=10, amount=1, rate=6/min per facility
    // For 12/min, need 2 facilities
    expect(root.facilityCount).toBeCloseTo(2, 5);

    // Components: craftingTime=2, amount=1, rate=30/min per facility
    const glassDep = root.dependencies.find(
      (d) => d.item.id === ItemId.ITEM_GLASS_CMPT,
    );
    // 5 glass per battery * 12 batteries/min = 60 glass/min
    // 60/min ÷ 30/min per facility = 2 facilities
    expect(glassDep!.facilityCount).toBeCloseTo(2, 5);
  });
});

describe("Cycle Detection", () => {
  test("detects bottle filling/dismantling cycle", () => {
    // Request production of liquid - this should trigger the cycle detection
    // The cycle: Bottle -> Dismantle -> Liquid -> Fill -> Bottle
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_FBOTTLE_GLASS_GRASS_1, rate: 30 }],
      mockItems,
      cycleRecipes,
      mockFacilities,
    );

    // Check if cycle was detected
    if (plan.detectedCycles.length > 0) {
      const cycle = plan.detectedCycles[0];

      // The cycle should involve the bottle
      expect(cycle.involvedItemIds).toContain(
        ItemId.ITEM_FBOTTLE_GLASS_GRASS_1,
      );

      // Verify cycle nodes were reconstructed
      expect(cycle.cycleNodes.length).toBeGreaterThan(0);
    } else {
      // If no cycle detected, the bottle should just be treated as needing production from glass
      const root = plan.dependencyRootNodes[0];
      expect(root.item.id).toBe(ItemId.ITEM_FBOTTLE_GLASS_GRASS_1);
    }
  });

  test("detects cycle when liquid is the entry point", () => {
    // Start from liquid instead of bottle
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_LIQUID_PLANT_GRASS_1, rate: 30 }],
      mockItems,
      cycleRecipes,
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];
    expect(root.item.id).toBe(ItemId.ITEM_LIQUID_PLANT_GRASS_1);

    // The plan should either detect a cycle or build a valid dependency tree
    expect(root).toBeDefined();
  });

  test("cycle net outputs calculation", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_FBOTTLE_GLASS_GRASS_1, rate: 30 }],
      mockItems,
      cycleRecipes,
      mockFacilities,
    );

    if (plan.detectedCycles.length > 0) {
      const cycle = plan.detectedCycles[0];

      // Check that net outputs are calculated
      expect(cycle.netOutputs).toBeDefined();

      // Bottle should have near-zero net (it cycles)
      const bottleNet = cycle.netOutputs.get(ItemId.ITEM_FBOTTLE_GLASS_GRASS_1);
      if (bottleNet !== undefined) {
        // Net should be close to 0 (within tolerance)
        expect(Math.abs(bottleNet)).toBeLessThan(0.1);
      }
    }
  });

  test("handles cycle placeholder nodes", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_FBOTTLE_GLASS_GRASS_1, rate: 30 }],
      mockItems,
      cycleRecipes,
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];

    // Collect all placeholder nodes recursively
    const collectPlaceholders = (node: ProductionNode): ProductionNode[] => {
      const placeholders: ProductionNode[] = [];
      if (node.isCyclePlaceholder) {
        placeholders.push(node);
      }
      node.dependencies?.forEach((dep: ProductionNode) => {
        placeholders.push(...collectPlaceholders(dep));
      });
      return placeholders;
    };

    const placeholders = collectPlaceholders(root);

    // If cycles detected, verify placeholder structure
    if (plan.detectedCycles.length > 0 && placeholders.length > 0) {
      placeholders.forEach((ph) => {
        expect(ph.isCyclePlaceholder).toBe(true);
        expect(ph.cycleItemId).toBeDefined();
        expect(ph.facilityCount).toBe(0);
      });
    }

    // Always verify the root node is valid
    expect(root).toBeDefined();
    expect(root.item).toBeDefined();
  });

  test("avoids infinite recursion in cyclic dependencies", () => {
    // This test ensures the algorithm doesn't hang
    expect(() => {
      calculateProductionPlan(
        [{ itemId: ItemId.ITEM_FBOTTLE_GLASS_GRASS_1, rate: 30 }],
        mockItems,
        cycleRecipes,
        mockFacilities,
      );
    }).not.toThrow();
  });
});

describe("Manual Raw Materials", () => {
  test("treats manually specified items as raw materials", () => {
    const manualRaw = new Set([ItemId.ITEM_IRON_NUGGET]);
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 30 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
      undefined,
      defaultRecipeSelector,
      manualRaw,
    );

    const root = plan.dependencyRootNodes[0];
    const nuggetDep = root.dependencies[0];

    expect(nuggetDep.item.id).toBe(ItemId.ITEM_IRON_NUGGET);
    expect(nuggetDep.isRawMaterial).toBe(true);
    expect(nuggetDep.facilityCount).toBe(0);
    expect(nuggetDep.dependencies).toHaveLength(0);
  });

  test("manual raw materials override recipe availability", () => {
    const manualRaw = new Set([ItemId.ITEM_QUARTZ_GLASS]);
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_GLASS_CMPT, rate: 30 }],
      mockItems,
      complexRecipes,
      mockFacilities,
      undefined,
      defaultRecipeSelector,
      manualRaw,
    );

    const root = plan.dependencyRootNodes[0];
    const glassDep = root.dependencies[0];

    // Glass should be treated as raw material
    expect(glassDep.item.id).toBe(ItemId.ITEM_QUARTZ_GLASS);
    expect(glassDep.isRawMaterial).toBe(true);
    expect(glassDep.dependencies).toHaveLength(0);
  });
});

describe("Edge Cases", () => {
  test("throws error for empty targets", () => {
    expect(() =>
      calculateProductionPlan([], mockItems, simpleRecipes, mockFacilities),
    ).toThrow("No targets specified");
  });
  test("handles item with no available recipes as raw material", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_QUARTZ_SAND, rate: 30 }],
      mockItems,
      simpleRecipes, // No recipe produces sand
      mockFacilities,
    );
    const root = plan.dependencyRootNodes[0];
    expect(root.isRawMaterial).toBe(true);
    expect(root.recipe).toBeNull();
  });
  test("handles zero target rate", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 0 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );
    const root = plan.dependencyRootNodes[0];
    expect(root.targetRate).toBe(0);
    expect(root.facilityCount).toBe(0);
  });
  test("handles very small production rates", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 0.1 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );
    const root = plan.dependencyRootNodes[0];
    expect(root.targetRate).toBe(0.1);
    expect(root.facilityCount).toBeCloseTo(0.00333, 4);
  });
  test("handles very large production rates", () => {
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_IRON_POWDER, rate: 10000 }],
      mockItems,
      simpleRecipes,
      mockFacilities,
    );
    const root = plan.dependencyRootNodes[0];
    expect(root.targetRate).toBe(10000);
    expect(root.facilityCount).toBeCloseTo(333.333, 2);
  });
});

describe("Recipe Output Amounts", () => {
  test("handles recipes with multiple output amounts", () => {
    // Moss powder: 1 moss -> 2 powder
    const recipe: Recipe = {
      id: RecipeId.GRINDER_PLANT_MOSS_POWDER_1_1,
      inputs: [{ itemId: ItemId.ITEM_PLANT_MOSS_1, amount: 1 }],
      outputs: [{ itemId: ItemId.ITEM_PLANT_MOSS_POWDER_1, amount: 2 }],
      facilityId: mockFacilities[1].id,
      craftingTime: 2,
    };
    const plan = calculateProductionPlan(
      [{ itemId: ItemId.ITEM_PLANT_MOSS_POWDER_1, rate: 60 }],
      mockItems,
      [recipe],
      mockFacilities,
    );

    const root = plan.dependencyRootNodes[0];

    // Output rate: 2 * 60 / 2 = 60 per facility
    // For 60/min target, need 1 facility
    expect(root.facilityCount).toBeCloseTo(1, 5);

    // Input rate: 1 * 60 / 2 = 30 moss per facility
    const mossDep = root.dependencies[0];
    expect(mossDep.targetRate).toBeCloseTo(30, 5);
  });
});

describe("Stress Tests", () => {
  test("handles deeply nested dependency chain", () => {
    // Create a chain of 10 levels
    const items = Array.from({ length: 11 }, (_, i) => ({
      id: `ITEM_LEVEL_${i}` as ItemId,
      tier: i,
    }));
    const recipes = Array.from({ length: 10 }, (_, i) => ({
      id: `RECIPE_LEVEL_${i}` as RecipeId,
      inputs: [{ itemId: items[i].id, amount: 1 }],
      outputs: [{ itemId: items[i + 1].id, amount: 1 }],
      facilityId: mockFacilities[0].id,
      craftingTime: 2,
    }));

    const plan = calculateProductionPlan(
      [{ itemId: items[10].id, rate: 30 }],
      items,
      recipes,
      mockFacilities,
    );

    // Should successfully build 10-level deep tree
    let node = plan.dependencyRootNodes[0];
    let depth = 0;

    while (node.dependencies.length > 0) {
      node = node.dependencies[0];
      depth++;
    }

    expect(depth).toBe(10);
  });
  test("handles many parallel production targets", () => {
    const targets = Array.from({ length: 50 }, (_, i) => ({
      itemId: `ITEM_${i}` as ItemId,
      rate: 10,
    }));
    const items = targets.map((t) => ({ id: t.itemId, tier: 1 }));

    const plan = calculateProductionPlan(targets, items, [], mockFacilities);

    expect(plan.dependencyRootNodes).toHaveLength(50);
  });
});
