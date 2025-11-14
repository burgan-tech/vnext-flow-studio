/**
 * Diff engine - computes differences between local and runtime graphs
 */

import * as semver from 'semver';
import type { Graph, ComponentId, GraphNode, GraphEdge as _GraphEdge } from '../types/index.js';
import type {
  GraphDelta,
  AnyViolation,
  ViolationSeverity as _ViolationSeverity,
  NodeAddedViolation,
  NodeRemovedViolation,
  NodeChangedViolation,
  VersionDriftViolation,
  SemverViolation,
  MissingDependencyViolation,
  CircularDependencyViolation,
  ApiDriftViolation,
  ConfigDriftViolation
} from '../types/diff.js';
import { parseComponentId, toComponentIdWithoutVersion } from '../types/index.js';
import { getAllNodes, getOutgoingEdges, hasNode, getNode } from '../graph/Graph.js';

/**
 * Compute diff between local and runtime graphs
 */
export function diffGraphs(local: Graph, runtime: Graph): GraphDelta {
  const violations: AnyViolation[] = [];

  // Detect added, removed, and changed nodes
  violations.push(...detectNodeDifferences(local, runtime));

  // Detect version drift
  violations.push(...detectVersionDrift(local, runtime));

  // Detect API and config drift
  violations.push(...detectHashDrift(local, runtime));

  // Detect semver violations in local graph
  violations.push(...detectSemverViolations(local));

  // Detect missing dependencies in local graph
  violations.push(...detectMissingDependencies(local));

  // Detect circular dependencies in local graph
  violations.push(...detectCircularDependencies(local));

  // Group by severity
  const bySeverity = {
    error: violations.filter(v => v.severity === 'error'),
    warning: violations.filter(v => v.severity === 'warning'),
    info: violations.filter(v => v.severity === 'info')
  };

  // Calculate stats
  const stats = {
    totalViolations: violations.length,
    errorCount: bySeverity.error.length,
    warningCount: bySeverity.warning.length,
    infoCount: bySeverity.info.length,
    nodesAdded: violations.filter(v => v.type === 'node-added').length,
    nodesRemoved: violations.filter(v => v.type === 'node-removed').length,
    nodesChanged: violations.filter(v => v.type === 'node-changed').length
  };

  return {
    violations,
    bySeverity,
    stats,
    timestamp: Date.now(),
    metadata: {
      localGraphSource: local.metadata?.source,
      runtimeGraphSource: runtime.metadata?.source,
      environmentId: runtime.metadata?.environmentId
    }
  };
}

/**
 * Detect nodes that are added, removed, or changed
 */
function detectNodeDifferences(local: Graph, runtime: Graph): AnyViolation[] {
  const violations: AnyViolation[] = [];

  const localNodes = new Set(local.nodes.keys());
  const runtimeNodes = new Set(runtime.nodes.keys());

  // Detect added nodes (in local but not in runtime)
  for (const nodeId of localNodes) {
    if (!runtimeNodes.has(nodeId)) {
      const node = local.nodes.get(nodeId)!;
      const ref = parseComponentId(nodeId);

      if (ref) {
        const violation: NodeAddedViolation = {
          type: 'node-added',
          severity: 'info',
          componentIds: [nodeId],
          message: `Component ${ref.key}@${ref.version} exists in local but not in runtime`,
          details: {
            ref,
            componentType: node.type
          }
        };
        violations.push(violation);
      }
    }
  }

  // Detect removed nodes (in runtime but not in local)
  for (const nodeId of runtimeNodes) {
    if (!localNodes.has(nodeId)) {
      const node = runtime.nodes.get(nodeId)!;
      const ref = parseComponentId(nodeId);

      if (ref) {
        const violation: NodeRemovedViolation = {
          type: 'node-removed',
          severity: 'warning',
          componentIds: [nodeId],
          message: `Component ${ref.key}@${ref.version} exists in runtime but not in local`,
          details: {
            ref,
            componentType: node.type
          }
        };
        violations.push(violation);
      }
    }
  }

  // Detect changed nodes (different content)
  for (const nodeId of localNodes) {
    if (runtimeNodes.has(nodeId)) {
      const localNode = local.nodes.get(nodeId)!;
      const runtimeNode = runtime.nodes.get(nodeId)!;

      const changes = detectNodeChanges(localNode, runtimeNode);
      if (changes.length > 0) {
        const ref = parseComponentId(nodeId);

        if (ref) {
          const violation: NodeChangedViolation = {
            type: 'node-changed',
            severity: 'info',
            componentIds: [nodeId],
            message: `Component ${ref.key}@${ref.version} has changes: ${changes.join(', ')}`,
            details: {
              ref,
              changes
            }
          };
          violations.push(violation);
        }
      }
    }
  }

  return violations;
}

/**
 * Detect changes between two nodes
 */
function detectNodeChanges(local: GraphNode, runtime: GraphNode): string[] {
  const changes: string[] = [];

  if (local.label !== runtime.label) {
    changes.push('label');
  }

  if (JSON.stringify(local.tags) !== JSON.stringify(runtime.tags)) {
    changes.push('tags');
  }

  return changes;
}

/**
 * Detect version drift (same component, different versions)
 */
function detectVersionDrift(local: Graph, runtime: Graph): VersionDriftViolation[] {
  const violations: VersionDriftViolation[] = [];

  // Build a map of component → versions for both graphs
  const localVersions = new Map<string, Set<string>>();
  const runtimeVersions = new Map<string, Set<string>>();

  for (const nodeId of local.nodes.keys()) {
    const ref = parseComponentId(nodeId);
    if (ref) {
      const key = toComponentIdWithoutVersion(ref);
      if (!localVersions.has(key)) {
        localVersions.set(key, new Set());
      }
      localVersions.get(key)!.add(ref.version);
    }
  }

  for (const nodeId of runtime.nodes.keys()) {
    const ref = parseComponentId(nodeId);
    if (ref) {
      const key = toComponentIdWithoutVersion(ref);
      if (!runtimeVersions.has(key)) {
        runtimeVersions.set(key, new Set());
      }
      runtimeVersions.get(key)!.add(ref.version);
    }
  }

  // Check for version mismatches
  for (const [key, localVers] of localVersions) {
    const runtimeVers = runtimeVersions.get(key);

    if (runtimeVers) {
      // Find versions that differ
      const localVerArray = Array.from(localVers);
      const runtimeVerArray = Array.from(runtimeVers);

      // If there are different versions, report drift
      if (JSON.stringify(localVerArray.sort()) !== JSON.stringify(runtimeVerArray.sort())) {
        // Parse the key to get component info
        const match = key.match(/^([^/]+)\/([^/]+)\/(.+)$/);
        if (match) {
          const ref = {
            domain: match[1],
            flow: match[2],
            key: match[3],
            version: localVerArray[0] // Use first version as reference
          };

          const violation: VersionDriftViolation = {
            type: 'version-drift',
            severity: 'warning',
            componentIds: [`${key}@${localVerArray[0]}`],
            message: `Version drift for ${ref.key}: local has ${localVerArray.join(', ')}, runtime has ${runtimeVerArray.join(', ')}`,
            details: {
              ref,
              localVersion: localVerArray.join(', '),
              runtimeVersion: runtimeVerArray.join(', ')
            }
          };
          violations.push(violation);
        }
      }
    }
  }

  return violations;
}

/**
 * Detect API and config drift using hashes
 */
function detectHashDrift(local: Graph, runtime: Graph): (ApiDriftViolation | ConfigDriftViolation)[] {
  const violations: (ApiDriftViolation | ConfigDriftViolation)[] = [];

  // Check nodes that exist in both graphs
  for (const [nodeId, localNode] of local.nodes) {
    const runtimeNode = runtime.nodes.get(nodeId);

    if (runtimeNode) {
      const ref = parseComponentId(nodeId);
      if (!ref) continue;

      // Check API drift
      if (localNode.apiHash && runtimeNode.apiHash && localNode.apiHash !== runtimeNode.apiHash) {
        const violation: ApiDriftViolation = {
          type: 'api-drift',
          severity: 'error',
          componentIds: [nodeId],
          message: `API breaking change detected in ${ref.key}@${ref.version}`,
          details: {
            ref,
            localHash: localNode.apiHash,
            runtimeHash: runtimeNode.apiHash
          }
        };
        violations.push(violation);
      }

      // Check config drift
      if (localNode.configHash && runtimeNode.configHash && localNode.configHash !== runtimeNode.configHash) {
        const violation: ConfigDriftViolation = {
          type: 'config-drift',
          severity: 'warning',
          componentIds: [nodeId],
          message: `Configuration drift detected in ${ref.key}@${ref.version}`,
          details: {
            ref,
            localHash: localNode.configHash,
            runtimeHash: runtimeNode.configHash
          }
        };
        violations.push(violation);
      }
    }
  }

  return violations;
}

/**
 * Detect semver violations (dependencies don't satisfy version ranges)
 */
function detectSemverViolations(graph: Graph): SemverViolation[] {
  const violations: SemverViolation[] = [];

  for (const node of getAllNodes(graph)) {
    const edges = getOutgoingEdges(graph, node.id);

    for (const edge of edges) {
      if (edge.versionRange) {
        const targetNode = getNode(graph, edge.to);

        if (targetNode) {
          const targetRef = parseComponentId(edge.to);
          if (!targetRef) continue;

          // Check if target version satisfies the range
          if (!semver.satisfies(targetRef.version, edge.versionRange)) {
            const dependentRef = parseComponentId(node.id);
            if (!dependentRef) continue;

            const violation: SemverViolation = {
              type: 'semver-violation',
              severity: 'error',
              componentIds: [node.id, edge.to],
              message: `${dependentRef.key} requires ${targetRef.key}@${edge.versionRange}, but found ${targetRef.version}`,
              details: {
                dependent: dependentRef,
                dependency: targetRef,
                requiredRange: edge.versionRange,
                actualVersion: targetRef.version
              }
            };
            violations.push(violation);
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Detect missing dependencies (referenced components don't exist)
 */
function detectMissingDependencies(graph: Graph): MissingDependencyViolation[] {
  const violations: MissingDependencyViolation[] = [];

  for (const node of getAllNodes(graph)) {
    const edges = getOutgoingEdges(graph, node.id);

    for (const edge of edges) {
      // Check if target node exists
      if (!hasNode(graph, edge.to)) {
        const dependentRef = parseComponentId(node.id);
        const missingRef = parseComponentId(edge.to);

        if (dependentRef && missingRef) {
          const violation: MissingDependencyViolation = {
            type: 'missing-dependency',
            severity: 'error',
            componentIds: [node.id],
            message: `${dependentRef.key} depends on ${missingRef.key}@${missingRef.version}, which does not exist`,
            details: {
              dependent: dependentRef,
              missingRef,
              dependencyType: edge.type
            }
          };
          violations.push(violation);
        }
      }
    }
  }

  return violations;
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(graph: Graph): CircularDependencyViolation[] {
  const violations: CircularDependencyViolation[] = [];
  const visited = new Set<ComponentId>();
  const recursionStack = new Set<ComponentId>();
  const cycles = new Set<string>();

  function dfs(nodeId: ComponentId, path: ComponentId[]): void {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart).concat(nodeId);

      // Create a canonical representation of the cycle to avoid duplicates
      const canonical = cycle.sort().join('→');
      if (cycles.has(canonical)) {
        return;
      }
      cycles.add(canonical);

      // Create violation
      const cycleRefs = cycle
        .map(id => parseComponentId(id))
        .filter((ref): ref is NonNullable<typeof ref> => ref !== null);

      if (cycleRefs.length > 0) {
        const cyclePath = cycleRefs.map(ref => `${ref.key}@${ref.version}`).join(' → ');

        const violation: CircularDependencyViolation = {
          type: 'circular-dependency',
          severity: 'error',
          componentIds: cycle,
          message: `Circular dependency detected: ${cyclePath}`,
          details: {
            cycle: cycleRefs,
            cyclePath
          }
        };
        violations.push(violation);
      }

      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    // Visit all dependencies
    const edges = getOutgoingEdges(graph, nodeId);
    for (const edge of edges) {
      dfs(edge.to, [...path, nodeId]);
    }

    recursionStack.delete(nodeId);
  }

  // Run DFS from each node
  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId, []);
    }
  }

  return violations;
}
