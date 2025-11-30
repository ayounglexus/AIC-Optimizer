import type { Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

/**
 * Applies dynamic styling to edges based on their flow rates.
 *
 * This creates a visual hierarchy where higher-throughput connections are
 * more prominent (thicker, more saturated) than lower-throughput ones.
 *
 * The styling includes:
 * - Non-linear width scaling (using square root for smoother transitions)
 * - HSL color variation (lightness and saturation)
 * - Fixed arrow size for consistency
 * - Enhanced label readability
 *
 * @param edges Array of edges to style
 * @returns The same edges array with style properties applied
 */
export function applyEdgeStyling(edges: Edge[]): Edge[] {
  if (edges.length === 0) {
    return edges;
  }

  // Collect all flow rates for normalization
  const flowRates: number[] = edges
    .map((e) => (e.data as { flowRate?: number } | undefined)?.flowRate ?? 0)
    .filter((rate) => rate > 0);

  if (flowRates.length === 0) {
    return edges;
  }

  const maxFlow = Math.max(...flowRates);
  const minFlow = Math.min(...flowRates);
  const flowRange = maxFlow - minFlow || 1; // Prevent division by zero

  const fixedMarkerSize = 8; // Fixed arrow size for all edges

  edges.forEach((edge) => {
    const flowRate =
      (edge.data as { flowRate?: number } | undefined)?.flowRate ?? 0;
    const normalizedFlow = (flowRate - minFlow) / flowRange;

    // 1. Non-linear width mapping (square root provides smoother visual scaling)
    const minWidth = 2;
    const maxWidth = 8;
    const strokeWidth =
      minWidth + Math.sqrt(normalizedFlow) * (maxWidth - minWidth);

    // 2. Color calculation using HSL for better visual gradation
    // Higher flow = darker and more saturated blue
    const minLightness = 45;
    const maxLightness = 85;
    const lightness =
      minLightness + normalizedFlow * (maxLightness - minLightness);

    const minSaturation = 70;
    const maxSaturation = 95;
    const saturation =
      minSaturation +
      Math.sqrt(normalizedFlow) * (maxSaturation - minSaturation);

    const edgeColor = `hsl(217, ${saturation}%, ${lightness}%)`;

    // 3. Apply stroke styling
    edge.style = {
      strokeWidth,
      stroke: edgeColor,
    };

    // 4. Apply fixed-size arrow marker with matching color
    edge.markerEnd = {
      type: MarkerType.ArrowClosed,
      color: edgeColor,
      width: fixedMarkerSize,
      height: fixedMarkerSize,
    };

    // 5. Style label for better readability
    edge.labelStyle = {
      fontSize: 11,
      fontWeight: 600,
      fill: edgeColor,
    };

    edge.labelBgStyle = {
      fill: "white",
      fillOpacity: 0.9,
    };
  });

  return edges;
}
