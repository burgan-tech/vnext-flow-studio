#!/usr/bin/env node
/**
 * Compare local workspace graph with runtime graph
 * Shows drift detection and impact analysis
 */

import { buildLocalGraph, getGraphStats, getAllEdges, getNode } from './packages/graph-core/dist/index.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';

async function compareGraphs() {
  console.log('🔍 Graph Comparison: Local vs Runtime\n');

  // Get paths
  const localPath = process.argv[2] || process.cwd();
  console.log(`📁 Local workspace: ${localPath}`);

  // Configure runtime environment
  const envConfig = {
    id: 'local',
    name: 'Local Development',
    baseUrl: 'http://localhost:4201',
    domain: 'core',
    auth: {
      type: 'none'
    }
  };

  console.log(`📡 Runtime: ${envConfig.baseUrl}\n`);

  try {
    // ========================================
    // BUILD LOCAL GRAPH
    // ========================================
    console.log('⏳ Building local graph...');
    const localGraph = await buildLocalGraph({
      basePath: localPath,
      computeHashes: true
    });
    const localStats = getGraphStats(localGraph);
    console.log(`✅ Local: ${localStats.nodeCount} components, ${localStats.edgeCount} dependencies\n`);

    // ========================================
    // FETCH RUNTIME GRAPH
    // ========================================
    console.log('⏳ Fetching runtime graph...');
    const adapter = new AmorphieRuntimeAdapter();
    const runtimeGraph = await adapter.fetchGraph(envConfig, {
      computeHashes: true,
      includeTypes: ['workflow', 'task', 'schema', 'view', 'function', 'extension']
    });
    const runtimeStats = getGraphStats(runtimeGraph);
    console.log(`✅ Runtime: ${runtimeStats.nodeCount} components, ${runtimeStats.edgeCount} dependencies\n`);

    // ========================================
    // COMPARE COMPONENTS
    // ========================================
    console.log('═══════════════════════════════════════');
    console.log('📊 COMPONENT COMPARISON');
    console.log('═══════════════════════════════════════\n');

    const localIds = new Set(localGraph.nodes.keys());
    const runtimeIds = new Set(runtimeGraph.nodes.keys());

    // Components only in local (need deployment)
    const onlyLocal = Array.from(localIds).filter(id => !runtimeIds.has(id));

    // Components only in runtime (deleted locally or from other projects)
    const onlyRuntime = Array.from(runtimeIds).filter(id => !localIds.has(id));

    // Components in both
    const inBoth = Array.from(localIds).filter(id => runtimeIds.has(id));

    console.log(`📈 Summary:`);
    console.log(`  Local only:   ${onlyLocal.length} (need deployment)`);
    console.log(`  Runtime only: ${onlyRuntime.length} (not in workspace)`);
    console.log(`  In both:      ${inBoth.length} (compare hashes)\n`);

    // ========================================
    // LOCAL ONLY (NEED DEPLOYMENT)
    // ========================================
    if (onlyLocal.length > 0) {
      console.log('═══════════════════════════════════════');
      console.log('🆕 COMPONENTS ONLY IN LOCAL (Need Deployment)');
      console.log('═══════════════════════════════════════\n');

      for (const id of onlyLocal.slice(0, 10)) {
        const node = getNode(localGraph, id);
        console.log(`  📦 ${node.ref.key} (${node.type})`);
        console.log(`     Domain: ${node.ref.domain}`);
        console.log(`     File: ${node.metadata?.filePath?.split('/').pop() || 'N/A'}`);
      }

      if (onlyLocal.length > 10) {
        console.log(`  ... and ${onlyLocal.length - 10} more\n`);
      }
    }

    // ========================================
    // RUNTIME ONLY
    // ========================================
    if (onlyRuntime.length > 0) {
      console.log('\n═══════════════════════════════════════');
      console.log('🌐 COMPONENTS ONLY IN RUNTIME');
      console.log('═══════════════════════════════════════\n');

      // Group by domain
      const byDomain = {};
      for (const id of onlyRuntime) {
        const node = getNode(runtimeGraph, id);
        const domain = node.ref.domain;
        if (!byDomain[domain]) {
          byDomain[domain] = [];
        }
        byDomain[domain].push(node);
      }

      for (const [domain, nodes] of Object.entries(byDomain)) {
        console.log(`  Domain: ${domain} (${nodes.length} components)`);
        for (const node of nodes.slice(0, 5)) {
          console.log(`    • ${node.ref.key} (${node.type})`);
        }
        if (nodes.length > 5) {
          console.log(`    ... and ${nodes.length - 5} more`);
        }
      }
    }

    // ========================================
    // HASH COMPARISON (DRIFT DETECTION)
    // ========================================
    if (inBoth.length > 0) {
      console.log('\n\n═══════════════════════════════════════');
      console.log('🔍 DRIFT DETECTION (Components in Both)');
      console.log('═══════════════════════════════════════\n');

      const apiDrifts = [];
      const configDrifts = [];
      const unchanged = [];

      for (const id of inBoth) {
        const localNode = getNode(localGraph, id);
        const runtimeNode = getNode(runtimeGraph, id);

        const apiDrift = localNode.apiHash !== runtimeNode.apiHash;
        const configDrift = localNode.configHash !== runtimeNode.configHash;

        if (apiDrift) {
          apiDrifts.push({ id, localNode, runtimeNode });
        } else if (configDrift) {
          configDrifts.push({ id, localNode, runtimeNode });
        } else {
          unchanged.push(id);
        }
      }

      console.log(`API Drift (Breaking Changes):    ${apiDrifts.length}`);
      console.log(`Config Drift (Behavior Changes): ${configDrifts.length}`);
      console.log(`Unchanged:                        ${unchanged.length}\n`);

      // Show API drifts (breaking changes)
      if (apiDrifts.length > 0) {
        console.log('⚠️  API DRIFT (Breaking Changes):\n');
        for (const { id, localNode, runtimeNode } of apiDrifts.slice(0, 5)) {
          console.log(`  📦 ${localNode.ref.key} (${localNode.type})`);
          console.log(`     Local API:   ${localNode.apiHash?.substring(0, 12)}...`);
          console.log(`     Runtime API: ${runtimeNode.apiHash?.substring(0, 12)}...`);

          // Show dependents (impact)
          const dependents = Array.from(localGraph.incomingEdges.get(id) || []);
          if (dependents.length > 0) {
            console.log(`     ⚠️  IMPACT: ${dependents.length} component(s) depend on this`);
          }
          console.log();
        }
      }

      // Show config drifts
      if (configDrifts.length > 0) {
        console.log('ℹ️  CONFIG DRIFT (Behavior Changes):\n');
        for (const { id, localNode, runtimeNode } of configDrifts.slice(0, 5)) {
          console.log(`  📦 ${localNode.ref.key} (${localNode.type})`);
          console.log(`     Local Config:   ${localNode.configHash?.substring(0, 12)}...`);
          console.log(`     Runtime Config: ${runtimeNode.configHash?.substring(0, 12)}...`);
          console.log();
        }
      }

      // Show unchanged
      if (unchanged.length > 0) {
        console.log(`✅ ${unchanged.length} component(s) unchanged (identical hashes)\n`);
      }
    }

    // ========================================
    // IMPACT ANALYSIS
    // ========================================
    console.log('\n═══════════════════════════════════════');
    console.log('💥 IMPACT ANALYSIS');
    console.log('═══════════════════════════════════════\n');

    // Find high-impact components that need deployment
    const needDeployment = [...onlyLocal];
    const impactMap = new Map();

    for (const id of needDeployment) {
      const dependents = Array.from(localGraph.incomingEdges.get(id) || []);
      if (dependents.length > 0) {
        impactMap.set(id, dependents.length);
      }
    }

    if (impactMap.size > 0) {
      const sorted = Array.from(impactMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log('Components with highest deployment impact:\n');
      for (const [id, count] of sorted) {
        const node = getNode(localGraph, id);
        console.log(`  ${node.ref.key.padEnd(40)} ${count} dependent(s)`);
      }
    } else {
      console.log('No high-impact components found.');
    }

    // ========================================
    // DEPLOYMENT RECOMMENDATION
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('🚀 DEPLOYMENT RECOMMENDATION');
    console.log('═══════════════════════════════════════\n');

    if (onlyLocal.length === 0) {
      console.log('✅ No new components to deploy.');
    } else {
      console.log(`📋 Components to deploy: ${onlyLocal.length}\n`);

      // Group by type
      const byType = {};
      for (const id of onlyLocal) {
        const node = getNode(localGraph, id);
        if (!byType[node.type]) {
          byType[node.type] = [];
        }
        byType[node.type].push(node.ref.key);
      }

      for (const [type, keys] of Object.entries(byType)) {
        console.log(`  ${type}s: ${keys.join(', ')}`);
      }
    }

    console.log('\n💡 Next Steps:');
    if (onlyLocal.length > 0) {
      console.log('  1. Review changes in components marked for deployment');
      console.log('  2. Run tests for high-impact components');
      console.log('  3. Deploy using: "Graph: Deploy Components"');
    } else {
      console.log('  • Local workspace is in sync with runtime');
      console.log('  • No deployment needed');
    }

    console.log('\n✨ Comparison complete!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

compareGraphs();
