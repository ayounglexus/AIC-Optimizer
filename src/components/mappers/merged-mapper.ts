import type { Node, Edge } from "@xyflow/react";
import type {
  Item,
  Facility,
  ProductionNode,
  FlowNodeData,
  FlowProductionNode,
  FlowTargetNode,
} from "@/types";
import {
  createFlowNodeKey,
  aggregateProductionNodes,
  findTargetsWithDownstream,
  createEdge,
  createProductionFlowNode,
  createTargetSinkNode,
} from "../flow/flow-utils";
import {
  createFlowNodeId,
  createFlowNodeIdFromNode,
  createTargetSinkId,
} from "@/lib/node-keys";
import { calculateDemandRate } from "@/lib/utils";

/**
 * Maps a UnifiedProductionPlan to React Flow nodes and edges in merged mode.
 *
 * In merged mode, identical production steps are combined into single nodes
 * showing aggregated facility counts and production rates. Production cycles
 * are visualized with special edge styling instead of being collapsed.
 *
 * @param rootNodes The root ProductionNodes of the dependency tree
 * @param items All available items in the game
 * @param facilities All available facilities in the game
 * @param detectedCycles Detected production cycles for visual highlighting
 * @returns An object containing the generated React Flow nodes and edges
 */
export function mapPlanToFlowMerged(
  rootNodes: ProductionNode[],
  items: Item[],
  facilities: Facility[],
): { nodes: (FlowProductionNode | FlowTargetNode)[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = [];
  const edges: Edge[] = [];
  const targetSinkNodes: FlowTargetNode[] = [];

  const aggregatedNodes = aggregateProductionNodes(rootNodes);
  const targetsWithDownstream = findTargetsWithDownstream(rootNodes);

  const getOrCreateNodeId = (node: ProductionNode): string => {
    if (node.isCyclePlaceholder && node.cycleItemId) {
      const productionKey = Array.from(aggregatedNodes.keys()).find((key) => {
        const parts = key.split("__");
        return parts[0] === node.cycleItemId && parts[2] === "prod";
      });

      if (productionKey) {
        return createFlowNodeId(productionKey);
      }
    }

    return createFlowNodeIdFromNode(node);
  };

  const traverse = (
    node: ProductionNode,
    parentId: string | null = null,
    edgeIdCounter: { count: number },
    flowToParent?: number,
  ): string => {
    const nodeId = getOrCreateNodeId(node);
    const key = createFlowNodeKey(node);

    if (node.isCyclePlaceholder) {
      if (parentId && parentId !== nodeId) {
        const cycleFlowRate = flowToParent ?? node.targetRate;

        console.log(`[Cycle Edge] ${node.item.id} (placeholder) -> parent`, {
          nodeId,
          parentId,
          cycleItemId: node.cycleItemId,
          targetRate: node.targetRate,
          flowToParent,
          cycleFlowRate,
        });

        edges.push(
          createEdge(
            `e${edgeIdCounter.count++}`,
            nodeId,
            parentId,
            cycleFlowRate,
            "backward",
          ),
        );
      }
      return nodeId;
    }

    // Skip targets without downstream
    if (node.isTarget && !targetsWithDownstream.has(key)) {
      node.dependencies.forEach((dep) =>
        traverse(dep, null, edgeIdCounter, dep.targetRate),
      );
      return nodeId;
    }

    // Create production node if not exists
    if (!nodes.find((n) => n.id === nodeId)) {
      const aggregatedData = aggregatedNodes.get(key)!;
      const isDirectTarget = node.isTarget && targetsWithDownstream.has(key);

      nodes.push(
        createProductionFlowNode(
          nodeId,
          {
            ...aggregatedData.node,
            targetRate: aggregatedData.totalRate,
            facilityCount: aggregatedData.totalFacilityCount,
          },
          items,
          facilities,
          {
            isDirectTarget,
            directTargetRate: isDirectTarget
              ? aggregatedData.totalRate
              : undefined,
          },
        ),
      );
    }

    // Create edge to parent
    if (parentId && parentId !== nodeId) {
      const edgeExists = edges.some(
        (e) => e.source === nodeId && e.target === parentId,
      );

      if (!edgeExists) {
        const flowRate = flowToParent ?? node.targetRate;
        edges.push(
          createEdge(`e${edgeIdCounter.count++}`, nodeId, parentId, flowRate),
        );
      }
    }

    node.dependencies.forEach((dep) => {
      // Calculate actual flow from dependency to current node based on recipe ratios
      let flowFromDep = dep.targetRate;

      if (node.recipe) {
        const aggregated = aggregatedNodes.get(key);
        const nodeRate = aggregated ? aggregated.totalRate : node.targetRate;

        const calculatedFlow = calculateDemandRate(
          node.recipe,
          dep.item.id,
          node.item.id,
          nodeRate,
        );
        if (calculatedFlow !== null) {
          flowFromDep = calculatedFlow;
        }
      }

      traverse(dep, nodeId, edgeIdCounter, flowFromDep);
    });
    return nodeId;
  };

  const edgeIdCounter = { count: 0 };
  rootNodes.forEach((root) => traverse(root, null, edgeIdCounter));

  // Create target sink nodes
  const targetNodes = Array.from(aggregatedNodes.entries()).filter(
    ([, data]) => data.node.isTarget && !data.node.isRawMaterial,
  );

  targetNodes.forEach(([key, data]) => {
    const targetNodeId = createTargetSinkId(data.node.item.id);
    const hasDownstream = targetsWithDownstream.has(key);

    targetSinkNodes.push(
      createTargetSinkNode(
        targetNodeId,
        data.node.item,
        data.totalRate,
        items,
        facilities,
        !hasDownstream
          ? {
              facility: data.node.facility,
              facilityCount: data.totalFacilityCount,
              recipe: data.node.recipe,
            }
          : undefined,
      ),
    );

    if (hasDownstream) {
      const nodeId = createFlowNodeId(key);

      edges.push(
        createEdge(
          `e${edgeIdCounter.count++}`,
          nodeId,
          targetNodeId,
          data.totalRate,
        ),
      );
    } else {
      edges.push(
        ...createTargetDependencyEdges(
          data.node,
          targetNodeId,
          data.totalRate,
          getOrCreateNodeId,
          edgeIdCounter,
        ),
      );
    }
  });

  return {
    nodes: [...nodes, ...targetSinkNodes] as (
      | FlowProductionNode
      | FlowTargetNode
    )[],
    edges: edges,
  };
}

/**
 * Helper: Creates edges for target dependencies
 */
function createTargetDependencyEdges(
  targetNode: ProductionNode,
  targetNodeId: string,
  totalRate: number,
  getOrCreateNodeId: (node: ProductionNode) => string,
  edgeIdCounter: { count: number },
): Edge[] {
  const edges: Edge[] = [];
  const recipe = targetNode.recipe;
  if (!recipe) return edges;

  targetNode.dependencies.forEach((dep) => {
    const depNodeId = getOrCreateNodeId(dep);
    const inputItem = recipe.inputs.find((inp) => inp.itemId === dep.item.id);
    const outputItem = recipe.outputs.find(
      (out) => out.itemId === targetNode.item.id,
    );

    if (!inputItem || !outputItem) return;

    const flowRate = (inputItem.amount / outputItem.amount) * totalRate;
    edges.push(
      createEdge(
        `e${edgeIdCounter.count++}`,
        depNodeId,
        targetNodeId,
        flowRate,
      ),
    );
  });

  return edges;
}
