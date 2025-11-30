import { Position, MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import type { Item, Facility } from "@/types";
import type { ProductionNode } from "@/lib/calculator";
import type { FlowNodeData, FlowProductionNode } from "./types";
import { applyEdgeStyling } from "./edge-styling";

/**
 * Creates a stable key for a ProductionNode in merged mode.
 *
 * This key is used to identify and merge nodes that represent the same
 * item, recipe, and raw material status across the dependency tree.
 *
 * @param node The ProductionNode to create a key for
 * @returns A unique string key for the node
 */
const createFlowNodeKey = (node: ProductionNode): string => {
  const itemId = node.item.id;
  const recipeId = node.recipe?.id ?? "raw";
  const rawFlag = node.isRawMaterial ? "raw" : "prod";
  return `${itemId}__${recipeId}__${rawFlag}`;
};

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
): { nodes: FlowProductionNode[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];
  const nodeKeyToId = new Map<string, string>();
  const nodeIdToRepresentativeNode = new Map<string, ProductionNode>();

  /**
   * Generates a stable and readable node ID from a given key.
   * A prefix is added to avoid collisions with other ID formats.
   *
   * @param key The unique key generated for a ProductionNode
   * @returns A formatted node ID
   */
  const makeNodeIdFromKey = (key: string) => `node-${key}`;

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
    nodeIdToRepresentativeNode.set(nodeId, node);
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

    // Add node if it doesn't exist yet (using the representative/first encountered instance)
    if (!nodes.find((n) => n.id === nodeId)) {
      const repNode = nodeIdToRepresentativeNode.get(nodeId) || node;
      const isCircular = repNode.isRawMaterial && repNode.recipe !== null;

      nodes.push({
        id: nodeId,
        type: "productionNode",
        data: {
          productionNode: repNode,
          isCircular,
          items,
          facilities,
        },
        position: { x: 0, y: 0 }, // Layout will be applied later
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

  // Apply dynamic styling to edges based on flow rates
  const styledEdges = applyEdgeStyling(edges);

  return {
    nodes: nodes as FlowProductionNode[],
    edges: styledEdges,
  };
}
