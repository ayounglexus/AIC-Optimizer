import type {
  CapacityPoolEntry,
  FacilityInstance,
  AllocationResult,
} from "./types";
import type { ProductionNode } from "@/lib/calculator";

/**
 * Manages capacity pools for production facilities in separated visualization mode.
 *
 * The CapacityPoolManager creates individual facility instances from ProductionNodes
 * and handles allocation of their production capacity to downstream consumers.
 * This ensures that production resources are efficiently shared and properly connected.
 */
export class CapacityPoolManager {
  private pools: Map<string, CapacityPoolEntry>;

  constructor() {
    this.pools = new Map();
  }

  /**
   * Creates a capacity pool for a production node by splitting it into individual facilities.
   *
   * Each facility is created with its own capacity. The last facility may operate at
   * partial capacity if the original facilityCount was fractional.
   *
   * @param node The production node to create a pool for
   * @param nodeKey Unique key identifying this production step
   */
  createPool(node: ProductionNode, nodeKey: string): void {
    // Raw materials don't need capacity pools
    if (node.isRawMaterial) {
      return;
    }

    // Calculate number of physical facilities (round up fractional counts)
    const facilityCount = Math.ceil(node.facilityCount);
    const capacityPerFacility = node.targetRate / node.facilityCount;

    const facilities: FacilityInstance[] = [];

    for (let i = 0; i < facilityCount; i++) {
      let actualOutputRate: number;

      if (i < facilityCount - 1) {
        // All facilities except the last one run at full capacity
        actualOutputRate = capacityPerFacility;
      } else {
        // Last facility may run at partial capacity
        const fractionalPart =
          node.facilityCount - Math.floor(node.facilityCount);
        if (fractionalPart > 0) {
          actualOutputRate = capacityPerFacility * fractionalPart;
        } else {
          actualOutputRate = capacityPerFacility;
        }
      }

      facilities.push({
        facilityId: `${nodeKey}-f${i}`,
        nodeKey,
        facilityIndex: i,
        maxOutputRate: capacityPerFacility,
        actualOutputRate,
        remainingCapacity: actualOutputRate,
      });
    }

    this.pools.set(nodeKey, {
      productionNode: node,
      totalCapacity: node.targetRate,
      facilities,
    });
  }

  /**
   * Allocates production capacity from a producer to satisfy consumer demand.
   *
   * Uses a greedy allocation strategy: fills facilities in order until demand is met.
   * May return multiple allocations if demand spans multiple facilities.
   *
   * @param nodeKey Key of the producer node to allocate from
   * @param demandRate Amount of production needed (items per minute)
   * @returns Array of allocations showing which facilities provide how much capacity
   */
  allocate(nodeKey: string, demandRate: number): AllocationResult[] {
    const pool = this.pools.get(nodeKey);
    if (!pool) {
      console.warn(`Capacity pool not found for key: ${nodeKey}`);
      return [];
    }

    const results: AllocationResult[] = [];
    let remainingDemand = demandRate;

    for (const facility of pool.facilities) {
      if (remainingDemand <= 0) {
        break;
      }

      const available = facility.remainingCapacity;
      if (available > 0) {
        // Allocate as much as possible from this facility
        const allocated = Math.min(available, remainingDemand);
        facility.remainingCapacity -= allocated;
        remainingDemand -= allocated;

        results.push({
          sourceNodeId: facility.facilityId,
          allocatedAmount: allocated,
          fromFacilityIndex: facility.facilityIndex,
        });
      }
    }

    // Warn if we couldn't satisfy all demand (shouldn't happen with correct calculations)
    if (remainingDemand > 0.001) {
      console.warn(
        `Insufficient capacity for ${nodeKey}: ${remainingDemand.toFixed(2)} /min unsatisfied`,
      );
    }

    return results;
  }

  /**
   * Gets all facility instances for a given production node.
   *
   * @param nodeKey Key of the production node
   * @returns Array of facility instances, or empty array if not found
   */
  getFacilityInstances(nodeKey: string): FacilityInstance[] {
    const pool = this.pools.get(nodeKey);
    return pool?.facilities ?? [];
  }

  /**
   * Checks if a production node has any remaining allocatable capacity.
   *
   * @param nodeKey Key of the production node
   * @returns True if capacity remains, false otherwise
   */
  hasCapacity(nodeKey: string): boolean {
    const pool = this.pools.get(nodeKey);
    if (!pool) return false;

    return pool.facilities.some((f) => f.remainingCapacity > 0);
  }

  /**
   * Calculates the total remaining capacity across all facilities for a node.
   * Useful for debugging and validation.
   *
   * @param nodeKey Key of the production node
   * @returns Total remaining capacity in items per minute
   */
  getTotalRemainingCapacity(nodeKey: string): number {
    const pool = this.pools.get(nodeKey);
    if (!pool) return 0;

    return pool.facilities.reduce((sum, f) => sum + f.remainingCapacity, 0);
  }

  /**
   * Gets all node keys that have capacity pools.
   * Useful for iteration and debugging.
   *
   * @returns Array of all node keys in the pool manager
   */
  getAllNodeKeys(): string[] {
    return Array.from(this.pools.keys());
  }
}
