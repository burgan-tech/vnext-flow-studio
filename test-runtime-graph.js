#!/usr/bin/env node
/**
 * Test fetching runtime graph from Amorphie runtime
 */

import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';
import { getGraphStats, getAllEdges, getNode } from './packages/graph-core/dist/index.js';

async function testRuntimeGraph() {
  console.log('🔍 Fetching Runtime Graph\n');

  // Configure environment
  const envConfig = {
    id: 'local',
    name: 'Local Development',
    baseUrl: 'http://localhost:4201',
    domain: 'core',
    auth: {
      type: 'none'
    }
  };

  try {
    console.log(`📡 Connecting to: ${envConfig.baseUrl}`);
    console.log(`📁 Domain: ${envConfig.domain}\n`);

    // Create adapter
    const adapter = new AmorphieRuntimeAdapter();

    // Test connection
    console.log('⏳ Testing connection...');
    const connected = await adapter.testConnection(envConfig);
    if (!connected) {
      console.error('❌ Failed to connect to runtime');
      process.exit(1);
    }
    console.log('✅ Connected successfully\n');

    // Fetch runtime graph
    console.log('⏳ Fetching runtime graph with full hashing...\n');
    const graph = await adapter.fetchGraph(envConfig, {
      computeHashes: true,
      includeTypes: ['workflow', 'task', 'schema']
    });

    const stats = getGraphStats(graph);
    const edges = getAllEdges(graph);

    // ========================================
    // OVERVIEW
    // ========================================
    console.log('═══════════════════════════════════════');
    console.log('📊 RUNTIME GRAPH OVERVIEW');
    console.log('═══════════════════════════════════════\n');

    console.log(`Total Components: ${stats.nodeCount}`);
    console.log(`Total Dependencies: ${stats.edgeCount}`);
    console.log(`Average Dependencies per Component: ${(stats.edgeCount / stats.nodeCount).toFixed(2)}\n`);

    console.log('Components by Type:');
    for (const [type, count] of Object.entries(stats.nodesByType)) {
      console.log(`  ${type.padEnd(12)} ${count}`);
    }

    console.log('\n📁 Components by Source:');
    for (const [source, count] of Object.entries(stats.nodesBySource)) {
      console.log(`  ${source.padEnd(12)} ${count}`);
    }

    // ========================================
    // SAMPLE COMPONENTS
    // ========================================
    console.log('\n═══════════════════════════════════════');
    console.log('🔖 SAMPLE COMPONENTS FROM RUNTIME');
    console.log('═══════════════════════════════════════\n');

    const sampleNodes = Array.from(graph.nodes.values()).slice(0, 5);
    for (const node of sampleNodes) {
      console.log(`\n📦 ${node.id}`);
      console.log(`   Type: ${node.type}`);
      console.log(`   Label: ${node.label || '(no label)'}`);
      console.log(`   Source: ${node.source}`);
      console.log(`   Tags: ${node.tags?.join(', ') || '(none)'}`);

      if (node.apiHash) {
        console.log(`   API Hash: ${node.apiHash.substring(0, 12)}...`);
      }
      if (node.configHash) {
        console.log(`   Config Hash: ${node.configHash.substring(0, 12)}...`);
      }

      if (node.metadata?.runtimeId) {
        console.log(`   Runtime ID: ${node.metadata.runtimeId}`);
      }
    }

    // ========================================
    // DEPENDENCIES
    // ========================================
    if (edges.length > 0) {
      console.log('\n\n═══════════════════════════════════════');
      console.log('🔗 RUNTIME DEPENDENCIES');
      console.log('═══════════════════════════════════════\n');

      console.log(`Total edges: ${edges.length}\n`);

      // Count by type
      const edgesByType = {};
      for (const edge of edges) {
        edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
      }

      console.log('Dependencies by Type:');
      for (const [type, count] of Object.entries(edgesByType)) {
        console.log(`  ${type.padEnd(12)} ${count}`);
      }

      console.log('\nSample edges:');
      for (const edge of edges.slice(0, 10)) {
        const fromNode = getNode(graph, edge.from);
        const toNode = getNode(graph, edge.to);
        console.log(`  ${fromNode?.ref.key || edge.from} → ${toNode?.ref.key || edge.to} (${edge.type})`);
      }
    }

    // ========================================
    // FIND OUR TEST WORKFLOW
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('🔎 FINDING TEST WORKFLOW');
    console.log('═══════════════════════════════════════\n');

    const testWorkflow = Array.from(graph.nodes.values())
      .find(n => n.ref.key === 'test-morph-idm');

    if (testWorkflow) {
      console.log('✅ Found test-morph-idm workflow!');
      console.log(`   ID: ${testWorkflow.id}`);
      console.log(`   Domain: ${testWorkflow.ref.domain}`);
      console.log(`   Type: ${testWorkflow.type}`);
      console.log(`   Source: ${testWorkflow.source}`);
      console.log(`   Runtime ID: ${testWorkflow.metadata?.runtimeId}`);
    } else {
      console.log('❌ Test workflow not found');
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('✨ SUMMARY');
    console.log('═══════════════════════════════════════\n');

    console.log('Runtime Graph Successfully Fetched:');
    console.log(`  ✓ ${stats.nodeCount} components from runtime`);
    console.log(`  ✓ ${stats.edgeCount} dependencies mapped`);
    console.log(`  ✓ ${Object.keys(stats.nodesByType).length} component types`);
    console.log(`  ✓ All components hashed for drift detection`);

    console.log('\nNext Steps:');
    console.log('  1. Build local graph from workspace');
    console.log('  2. Compare runtime vs local graphs');
    console.log('  3. Identify drift (missing, added, modified components)');
    console.log('  4. Analyze impact of changes');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRuntimeGraph();
