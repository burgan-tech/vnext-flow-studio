#!/usr/bin/env node
/**
 * Quick test script for graph-core functionality
 * Run with: node test-graph.js
 */

import { buildLocalGraph, getGraphStats } from './packages/graph-core/dist/index.js';

async function testGraph() {
  console.log('🔍 Testing Graph System\n');

  // Get path from command line argument or use current directory
  const targetPath = process.argv[2] || process.cwd();
  console.log(`Target path: ${targetPath}\n`);

  try {
    // Test local graph building
    console.log('Building local graph...');
    const graph = await buildLocalGraph({
      basePath: targetPath,
      computeHashes: true
    });

    // Get statistics
    const stats = getGraphStats(graph);

    console.log('\n✅ Local Graph Built Successfully!\n');
    console.log(`📊 Statistics:`);
    console.log(`  - Total Components: ${stats.nodeCount}`);
    console.log(`  - Total Dependencies: ${stats.edgeCount}`);

    console.log('\n📦 Components by Type:');
    for (const [type, count] of Object.entries(stats.nodesByType)) {
      console.log(`  - ${type}: ${count}`);
    }

    console.log('\n📁 Components by Source:');
    for (const [source, count] of Object.entries(stats.nodesBySource)) {
      console.log(`  - ${source}: ${count}`);
    }

    // Show sample components
    console.log('\n🔖 Sample Components:');
    const sampleNodes = Array.from(graph.nodes.values()).slice(0, 5);
    for (const node of sampleNodes) {
      console.log(`  - ${node.id} (${node.type})`);
      if (node.label) {
        console.log(`    Label: ${node.label}`);
      }
    }

    console.log('\n✨ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGraph();
