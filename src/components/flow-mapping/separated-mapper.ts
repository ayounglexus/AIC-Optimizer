import { Position, MarkerType } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import type { Item, Facility } from "@/types";
import type { ProductionNode } from "@/lib/calculator";
import type { FlowProductionNode, FlowNodeDataSeparated } from "./types";
import { CapacityPoolManager } from "./capacity-pool";
import { applyEdgeStyling } from "./edge-styling";

/**
 * Creates a stable key for a ProductionNode.
 *
 * This key identifies unique production steps across the dependency tree,
 * allowing proper merging of duplicate nodes before splitting into facilities.
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
 * Collects all unique production nodes from the dependency tree.
 *
 * Traverses the tree and deduplicates nodes based on their key,
 * keeping only the first encountered instance of each unique production step.
 *
 * @param rootNodes Root nodes of the dependency tree
 * @returns Map of node keys to their representative ProductionNode
 */
function collectUniqueNodes(
  rootNodes: ProductionNode[],
): Map<string, ProductionNode> {
  const nodeMap = new Map<string, ProductionNode>();

  const collect = (node: ProductionNode) => {
    const key = createFlowNodeKey(node);
    if (!nodeMap.has(key)) {
      nodeMap.set(key, node);
    }
    node.dependencies.forEach(collect);
  };

  rootNodes.forEach(collect);
  return nodeMap;
}

/**
 * Performs topological sort on production nodes to determine processing order.
 *
 * Returns nodes in dependency order (producers before consumers), ensuring that
 * when we allocate capacity, all upstream producers are already initialized.
 *
 * @param nodeMap Map of unique production nodes
 * @returns Array of node keys in topological order (leaves to roots)
 */
function topologicalSort(nodeMap: Map<string, ProductionNode>): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, Set<string>>();

  // Initialize structures
  nodeMap.forEach((_, key) => {
    inDegree.set(key, 0);
    adjList.set(key, new Set());
  });

  // Build adjacency list and calculate in-degrees
  nodeMap.forEach((node, key) => {
    node.dependencies.forEach((dep) => {
      const depKey = createFlowNodeKey(dep);
      if (nodeMap.has(depKey)) {
        adjList.get(depKey)!.add(key);
        inDegree.set(key, (inDegree.get(key) || 0) + 1);
      }
    });
  });

  // Start with nodes that have no dependencies (in-degree 0)
  const queue: string[] = [];
  inDegree.forEach((degree, key) => {
    if (degree === 0) {
      queue.push(key);
    }
  });

  // Process queue to build topological order
  const sorted: string[] = [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    sorted.push(key);

    // Reduce in-degree for dependent nodes
    adjList.get(key)!.forEach((dependentKey) => {
      const newDegree = inDegree.get(dependentKey)! - 1;
      inDegree.set(dependentKey, newDegree);
      if (newDegree === 0) {
        queue.push(dependentKey);
      }
    });
  }

  return sorted;
}

/**
 * Maps a UnifiedProductionPlan to React Flow nodes and edges in separated mode.
 *
 * In separated mode, each physical facility is represented as an individual node.
 * This provides a detailed view suitable for planning physical layouts and
 * understanding resource distribution.
 *
 * The algorithm:
 * 1. Collects and deduplicates production nodes
 * 2. Creates capacity pools for each unique production step
 * 3. Generates individual facility nodes
 * 4. Allocates capacity and creates edges using demand-driven allocation
 *
 * @param rootNodes The root ProductionNodes of the dependency tree
 * @param items All available items in the game
 * @param facilities All available facilities in the game
 * @returns An object containing the generated React Flow nodes and edges
 */
export function mapPlanToFlowSeparated(
  rootNodes: ProductionNode[],
  items: Item[],
  facilities: Facility[],
): { nodes: FlowProductionNode[]; edges: Edge[] } {
  // Step 1: Collect unique nodes and determine processing order
  const nodeMap = collectUniqueNodes(rootNodes);
  const sortedKeys = topologicalSort(nodeMap);

  // Step 2: Initialize capacity pool manager
  const poolManager = new CapacityPoolManager();

  sortedKeys.forEach((key) => {
    const node = nodeMap.get(key)!;
    poolManager.createPool(node, key);
  });

  // Step 3: Generate Flow nodes from facility instances
  const flowNodes: Node<FlowNodeDataSeparated>[] = [];

  nodeMap.forEach((node, key) => {
    if (node.isRawMaterial) {
      // Raw materials are shown as single nodes (no facility splitting)
      const isCircular = node.recipe !== null;
      flowNodes.push({
        id: `node-${key}`,
        type: "productionNode",
        data: {
          productionNode: node,
          isCircular,
          items,
          facilities,
        },
        position: { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    } else {
      // Production nodes are split into individual facilities
      const facilityInstances = poolManager.getFacilityInstances(key);
      const totalFacilities = facilityInstances.length;

      facilityInstances.forEach((facility) => {
        const isPartialLoad =
          facility.actualOutputRate < facility.maxOutputRate * 0.999; // Small epsilon for floating point comparison

        // Create a modified ProductionNode for this specific facility instance
        // with targetRate set to this facility's actual output rate
        const facilitySpecificNode: ProductionNode = {
          ...node,
          targetRate: facility.actualOutputRate,
          facilityCount: 1, // Each node represents exactly 1 facility
        };

        flowNodes.push({
          id: facility.facilityId,
          type: "productionNode",
          data: {
            productionNode: facilitySpecificNode,
            isCircular: false,
            items,
            facilities,
            // Separated mode specific fields
            facilityIndex: facility.facilityIndex,
            totalFacilities,
            isPartialLoad,
          },
          position: { x: 0, y: 0 },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });
      });
    }
  });
  // Step 4: Generate edges by allocating capacity
  const edges: Edge[] = [];
  let edgeIdCounter = 0;

  // Process nodes in reverse topological order (consumers before producers)
  // This ensures we connect from producers to consumers
  const reverseOrder = [...sortedKeys].reverse();

  reverseOrder.forEach((consumerKey) => {
    const consumerNode = nodeMap.get(consumerKey)!;

    // Skip raw materials (they don't consume anything)
    if (consumerNode.isRawMaterial) {
      return;
    }

    const consumerFacilities = consumerNode.isRawMaterial
      ? []
      : poolManager.getFacilityInstances(consumerKey);

    // For each consumer facility, allocate inputs from producer facilities
    consumerFacilities.forEach((consumerFacility) => {
      const consumerId = consumerFacility.facilityId;
      const consumerOutputRate = consumerFacility.actualOutputRate;

      // Process each dependency (input material)
      consumerNode.dependencies.forEach((dependency) => {
        const depKey = createFlowNodeKey(dependency);

        // Calculate demand rate for this specific consumer facility
        const recipe = consumerNode.recipe!;
        const inputItem = recipe.inputs.find(
          (inp) => inp.itemId === dependency.item.id,
        );
        const outputItem = recipe.outputs.find(
          (out) => out.itemId === consumerNode.item.id,
        );

        if (!inputItem || !outputItem) {
          console.warn(
            `Recipe mismatch for ${consumerNode.item.id}: missing input or output`,
          );
          return;
        }

        // Calculate the input rate needed for this consumer's output rate
        const inputOutputRatio = inputItem.amount / outputItem.amount;
        const demandRate = inputOutputRatio * consumerOutputRate;

        // Allocate capacity from producer pool
        if (dependency.isRawMaterial) {
          // Connect directly to the raw material node
          const rawMaterialNodeId = `node-${depKey}`;
          edges.push({
            id: `e${edgeIdCounter++}`,
            source: rawMaterialNodeId,
            target: consumerId,
            type: "default",
            label: `${demandRate.toFixed(2)} /min`,
            data: { flowRate: demandRate },
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          });
        } else {
          // Allocate from capacity pool
          const allocations = poolManager.allocate(depKey, demandRate);

          allocations.forEach((allocation) => {
            edges.push({
              id: `e${edgeIdCounter++}`,
              source: allocation.sourceNodeId,
              target: consumerId,
              type: "default",
              label: `${allocation.allocatedAmount.toFixed(2)} /min`,
              data: { flowRate: allocation.allocatedAmount },
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
            });
          });
        }
      });
    });
  });

  // Apply dynamic styling to edges
  const styledEdges = applyEdgeStyling(edges);

  return {
    nodes: flowNodes as FlowProductionNode[],
    edges: styledEdges,
  };
}
