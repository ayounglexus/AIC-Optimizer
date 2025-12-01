import { Position, MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import type { Item, Facility, ItemId } from "@/types";
import type { ProductionNode } from "@/lib/calculator";
import type {
  FlowNodeData,
  FlowProductionNode,
  FlowTargetNode,
  TargetSinkNodeData,
} from "./types";
import { applyEdgeStyling } from "./edge-styling";
import {
  createFlowNodeKey,
  aggregateProductionNodes,
  createTargetMap,
  makeNodeIdFromKey,
} from "./flow-utils";

/**
 * Maps a UnifiedProductionPlan to React Flow nodes and edges in merged mode.
 *
 * In merged mode, identical production steps are combined into single nodes
 * showing aggregated facility counts and production rates. This provides
 * a high-level overview of the production requirements.
 *
 * The function traverses the dependency tree and creates:
 * - Nodes representing unique production steps
 * - Edges showing material flow between steps
 * - Styled edges based on flow rates
 *
 * @param rootNodes The root ProductionNodes of the dependency tree
 * @param items All available items in the game
 * @param facilities All available facilities in the game
 * @returns An object containing the generated React Flow nodes and edges
 */
export function mapPlanToFlowMerged(
  rootNodes: ProductionNode[],
  items: Item[],
  facilities: Facility[],
  originalTargets?: Array<{ itemId: ItemId; rate: number }>,
): { nodes: (FlowProductionNode | FlowTargetNode)[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];
  const nodeKeyToId = new Map<string, string>();
  const targetSinkNodes: Node<TargetSinkNodeData>[] = [];
  // Create a map of target items for quick lookup
  const targetMap = createTargetMap(originalTargets);

  const aggregatedNodes = aggregateProductionNodes(rootNodes);

  /**
   * Retrieves an existing node ID or creates a new one if the node hasn't been encountered.
   *
   * This ensures that nodes representing the same production entity share the same ID
   * and are properly merged in the visualization.
   *
   * @param node The ProductionNode for which to get or create an ID
   * @returns The unique ID for the node
   */
  const getOrCreateNodeId = (node: ProductionNode): string => {
    const key = createFlowNodeKey(node);
    if (nodeKeyToId.has(key)) {
      return nodeKeyToId.get(key)!;
    }
    const nodeId = makeNodeIdFromKey(key);
    nodeKeyToId.set(key, nodeId);
    return nodeId;
  };

  /**
   * Recursively traverses the production dependency tree to create nodes and edges.
   *
   * Uses depth-first traversal to build the complete graph, ensuring all dependencies
   * are processed and connected properly.
   *
   * @param node The current ProductionNode being processed
   * @param parentId The ID of the parent node in the flow graph, or null if it's a root
   * @param edgeIdCounter An object to keep track of unique edge IDs
   * @returns The ID of the current node
   */
  const traverse = (
    node: ProductionNode,
    parentId: string | null = null,
    edgeIdCounter: { count: number },
  ): string => {
    const nodeId = getOrCreateNodeId(node);
    const key = createFlowNodeKey(node);

    // Add node if it doesn't exist yet (using aggregated data)
    if (!nodes.find((n) => n.id === nodeId)) {
      const aggregatedData = aggregatedNodes.get(key)!;
      const isCircular = node.isRawMaterial && node.recipe !== null;

      // Check if this node is also a direct target
      const isDirectTarget = targetMap.has(node.item.id);
      const directTargetRate = isDirectTarget
        ? targetMap.get(node.item.id)
        : undefined;

      // Create a ProductionNode with aggregated totals for display
      const aggregatedNode: ProductionNode = {
        ...aggregatedData.node,
        targetRate: aggregatedData.totalRate,
        facilityCount: aggregatedData.totalFacilityCount,
      };

      nodes.push({
        id: nodeId,
        type: "productionNode",
        data: {
          productionNode: aggregatedNode,
          isCircular,
          items,
          facilities,
          isDirectTarget,
          directTargetRate,
        },
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    }

    // Create an edge from this node to its parent (if parent exists)
    // Edge labels show the flow rate for THIS specific dependency, not total node capacity
    if (parentId) {
      const flowRate = node.targetRate;

      // Avoid duplicate edges for shared dependencies
      const edgeExists = edges.some(
        (e) => e.source === nodeId && e.target === parentId,
      );

      if (!edgeExists) {
        const edgeId = `e${edgeIdCounter.count++}`;
        edges.push({
          id: edgeId,
          source: nodeId,
          target: parentId,
          type: "default",
          label: `${flowRate.toFixed(2)} /min`,
          data: { flowRate },
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        });
      }
    }

    // Recursively traverse dependencies
    node.dependencies.forEach((dep) => {
      traverse(dep, nodeId, edgeIdCounter);
    });

    return nodeId;
  };

  // Build the graph starting from all root nodes
  const edgeIdCounter = { count: 0 };
  rootNodes.forEach((root) => traverse(root, null, edgeIdCounter));

  if (originalTargets) {
    originalTargets.forEach((target) => {
      const item = items.find((i) => i.id === target.itemId);
      if (!item) return;

      const targetNodeId = `target-sink-${target.itemId}`;

      // Find the production node for this item
      const productionKey = Array.from(aggregatedNodes.keys()).find((key) => {
        const nodeData = aggregatedNodes.get(key)!;
        return (
          nodeData.node.item.id === target.itemId &&
          !nodeData.node.isRawMaterial
        );
      });

      if (productionKey) {
        const productionNodeId = makeNodeIdFromKey(productionKey);

        // Create target sink node
        targetSinkNodes.push({
          id: targetNodeId,
          type: "targetSink",
          data: {
            item,
            targetRate: target.rate,
            items,
          },
          position: { x: 0, y: 0 },
          targetPosition: Position.Left,
        });

        // Create edge from production node to target sink
        edges.push({
          id: `e${edgeIdCounter.count++}`,
          source: productionNodeId,
          target: targetNodeId,
          type: "default",
          label: `${target.rate.toFixed(2)} /min`,
          data: { flowRate: target.rate },
          animated: true, // Animate target edges for emphasis
          style: { stroke: "#10b981", strokeWidth: 2 }, // Green, thicker
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#10b981",
          },
        });
      }
    });
  }

  // Apply dynamic styling to edges based on flow rates
  const styledEdges = applyEdgeStyling(edges);

  return {
    nodes: [...nodes, ...targetSinkNodes] as (
      | FlowProductionNode
      | FlowTargetNode
    )[],
    edges: styledEdges,
  };
}
