import type { Node } from "@xyflow/react";
import type { Item, Facility } from "@/types";
import type { ProductionNode } from "@/lib/calculator";

/**
 * Visualization mode for the production dependency tree.
 * - 'merged': Combines identical production steps and shows aggregated facility counts
 * - 'separated': Shows each individual facility as a separate node
 */
export type VisualizationMode = "merged" | "separated";

/**
 * Base interface for the data expected by the CustomProductionNode component.
 * This is used for both merged and separated visualization modes.
 */
export interface FlowNodeData {
  productionNode: ProductionNode;
  isCircular: boolean;
  items: Item[];
  facilities: Facility[];
  [key: string]: unknown;
}

/**
 * Extended node data for separated visualization mode.
 * Adds facility-specific information for individual facility instances.
 */
export interface FlowNodeDataSeparated extends FlowNodeData {
  /** Zero-based index of this facility among all facilities of the same type */
  facilityIndex?: number;
  /** Total number of facilities of this type in the production chain */
  totalFacilities?: number;
  /** Whether this facility is operating at partial capacity (less than 100%) */
  isPartialLoad?: boolean;
}

/**
 * Type alias for a React Flow node containing production data.
 */
export type FlowProductionNode = Node<FlowNodeData | FlowNodeDataSeparated>;

/**
 * Represents a single physical facility instance in separated mode.
 * Each instance has its own capacity and can be connected independently.
 */
export interface FacilityInstance {
  /** Unique identifier for this facility instance (e.g., "node-iron-smelting-0") */
  facilityId: string;
  /** Reference to the original node key for traceability */
  nodeKey: string;
  /** Zero-based index of this facility among facilities of the same type */
  facilityIndex: number;
  /** Maximum output rate this facility can produce (items per minute) */
  maxOutputRate: number;
  /** Actual output rate this facility is producing (may be less than max for the last facility) */
  actualOutputRate: number;
  /** Remaining capacity available for allocation to consumers (items per minute) */
  remainingCapacity: number;
}

/**
 * Entry in the capacity pool representing all facilities for a specific production step.
 * The pool manages allocation of production capacity to downstream consumers.
 */
export interface CapacityPoolEntry {
  /** The original production node this pool represents */
  productionNode: ProductionNode;
  /** Total production capacity across all facilities (items per minute) */
  totalCapacity: number;
  /** Array of individual facility instances that make up this production step */
  facilities: FacilityInstance[];
}

/**
 * Result of allocating capacity from a producer to a consumer.
 * Multiple allocations may be needed if a single producer can't satisfy all demand.
 */
export interface AllocationResult {
  /** Node ID of the source facility providing the allocation */
  sourceNodeId: string;
  /** Amount allocated in this result (items per minute) */
  allocatedAmount: number;
  /** Index of the facility providing this allocation */
  fromFacilityIndex: number;
}
