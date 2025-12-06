import { Position, MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import type { Item, Facility } from "@/types";
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
  makeNodeIdFromKey,
  findTargetsWithDownstream,
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
): { nodes: (FlowProductionNode | FlowTargetNode)[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];
  const nodeKeyToId = new Map<string, string>();
  const targetSinkNodes: Node<TargetSinkNodeData>[] = [];

  const aggregatedNodes = aggregateProductionNodes(rootNodes);

  // Identify which targets are upstream of other targets
  const targetsWithDownstream = findTargetsWithDownstream(rootNodes);

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

    // Skip creating production node if it's a target without downstream
    const isTargetWithoutDownstream =
      node.isTarget && !targetsWithDownstream.has(key);

    if (isTargetWithoutDownstream) {
      // Don't create a production node for pure targets
      // They will only exist as target sink nodes

      // Still need to process dependencies
      node.dependencies.forEach((dep) => {
        traverse(dep, null, edgeIdCounter);
      });

      return nodeId;
    }

    // Add node if it doesn't exist yet (using aggregated data)
    if (!nodes.find((n) => n.id === nodeId)) {
      const aggregatedData = aggregatedNodes.get(key)!;
      const isCircular = node.isRawMaterial && node.recipe !== null;

      // Check if this node is a target with downstream (needs marking)
      const isDirectTarget = node.isTarget && targetsWithDownstream.has(key);
      const directTargetRate = isDirectTarget
        ? aggregatedData.totalRate
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

  // Create target sink nodes for all targets
  const targetNodes = Array.from(aggregatedNodes.entries()).filter(
    ([, data]) => data.node.isTarget && !data.node.isRawMaterial,
  );

  targetNodes.forEach(([key, data]) => {
    const targetNodeId = `target-sink-${data.node.item.id}`;
    const hasDownstream = targetsWithDownstream.has(key);

    // Prepare production info for terminal targets (targets without downstream)
    const productionInfo = !hasDownstream
      ? {
          facility: data.node.facility,
          facilityCount: data.totalFacilityCount,
          recipe: data.node.recipe,
        }
      : undefined;

    targetSinkNodes.push({
      id: targetNodeId,
      type: "targetSink",
      data: {
        item: data.node.item,
        targetRate: data.totalRate,
        items,
        facilities,
        productionInfo, // Pass production info for terminal targets
      },
      position: { x: 0, y: 0 },
      targetPosition: Position.Left,
    });

    if (hasDownstream) {
      // Target with downstream: connect from production node to target sink
      const productionNodeId = makeNodeIdFromKey(key);
      edges.push({
        id: `e${edgeIdCounter.count++}`,
        source: productionNodeId,
        target: targetNodeId,
        type: "default",
        label: `${data.totalRate.toFixed(2)} /min`,
        data: { flowRate: data.totalRate },
        animated: true,
        style: { stroke: "#10b981", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#10b981",
        },
      });
    } else {
      // Target without downstream: connect directly from its dependencies
      const targetNode = data.node;
      targetNode.dependencies.forEach((dep) => {
        const depKey = createFlowNodeKey(dep);
        const depNodeId = makeNodeIdFromKey(depKey);

        const recipe = targetNode.recipe;
        if (!recipe) return;

        const inputItem = recipe.inputs.find(
          (inp) => inp.itemId === dep.item.id,
        );
        const outputItem = recipe.outputs.find(
          (out) => out.itemId === targetNode.item.id,
        );

        if (!inputItem || !outputItem) return;

        const inputOutputRatio = inputItem.amount / outputItem.amount;
        const flowRate = inputOutputRatio * data.totalRate;

        edges.push({
          id: `e${edgeIdCounter.count++}`,
          source: depNodeId,
          target: targetNodeId,
          type: "default",
          label: `${flowRate.toFixed(2)} /min`,
          data: { flowRate },
          animated: true,
          style: { stroke: "#10b981", strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#10b981",
          },
        });
      });
    }
  });

  const styledEdges = applyEdgeStyling(edges);

  return {
    nodes: [...nodes, ...targetSinkNodes] as (
      | FlowProductionNode
      | FlowTargetNode
    )[],
    edges: styledEdges,
  };
}
