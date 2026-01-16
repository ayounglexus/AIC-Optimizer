import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Recipe, ItemId } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates demand rate for an input based on recipe ratios
 */
export function calculateDemandRate(
  recipe: Recipe,
  inputItemId: ItemId,
  outputItemId: ItemId,
  outputRate: number,
): number | null {
  const input = recipe.inputs.find((i) => i.itemId === inputItemId);
  const output = recipe.outputs.find((o) => o.itemId === outputItemId);

  if (!input || !output) return null;

  return (input.amount / output.amount) * outputRate;
}
