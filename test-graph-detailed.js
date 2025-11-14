#!/usr/bin/env node
/**
 * Detailed test script for graph-core functionality
 * Run with: node test-graph-detailed.js
 */

import { buildLocalGraph, getGraphStats, getAllEdges, getNode } from './packages/graph-core/dist/index.js';

async function testGraph() {
  console.log('🔍 Testing Graph System (Detailed)\n');

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

    // Show all workflows and check their definitions
    console.log('\n🔄 Workflow Analysis:');
    const workflows = Array.from(graph.nodes.values()).filter(n => n.type === 'workflow');
    console.log(`Found ${workflows.length} workflows\n`);

    for (const workflow of workflows.slice(0, 3)) {
      console.log(`\n📋 Workflow: ${workflow.id}`);
      if (workflow.definition) {
        const def = workflow.definition;
        const attrs = def.attributes || def; // Handle nested attributes

        console.log(`  - States: ${attrs.states?.length || 0}`);
        console.log(`  - Functions: ${attrs.functions?.length || 0}`);
        console.log(`  - Extensions: ${attrs.extensions?.length || 0}`);
        console.log(`  - Features: ${attrs.features?.length || 0}`);

        // Check if functions/extensions are defined
        if (attrs.functions && attrs.functions.length > 0) {
          console.log(`  - Function refs:`, attrs.functions.slice(0, 2));
        }
        if (attrs.extensions && attrs.extensions.length > 0) {
          console.log(`  - Extension refs:`, attrs.extensions.slice(0, 2));
        }
        if (attrs.features && attrs.features.length > 0) {
          console.log(`  - Feature refs:`, attrs.features.slice(0, 2));
        }

        // Check states for schema/view references
        if (attrs.states && attrs.states.length > 0) {
          const statesWithRefs = attrs.states.filter(s => s.schema || s.view || s.task);
          if (statesWithRefs.length > 0) {
            console.log(`  - States with refs: ${statesWithRefs.length}`);
            const sample = statesWithRefs[0];
            if (sample.schema) console.log(`    - Schema ref:`, sample.schema);
            if (sample.view) console.log(`    - View ref:`, sample.view);
            if (sample.task) console.log(`    - Task ref:`, sample.task);
          }
        }
      }
    }

    // Show edges
    const edges = getAllEdges(graph);
    console.log(`\n\n🔗 Dependencies (Edges):`);
    console.log(`Total edges: ${edges.length}\n`);

    if (edges.length > 0) {
      console.log('Sample edges:');
      for (const edge of edges.slice(0, 10)) {
        const fromNode = getNode(graph, edge.from);
        const toNode = getNode(graph, edge.to);
        console.log(`  ${fromNode?.ref.key || edge.from} → ${toNode?.ref.key || edge.to} (${edge.type})`);
      }
    } else {
      console.log('⚠️  No dependencies found. This could mean:');
      console.log('  1. Workflows don\'t reference functions/extensions/schemas');
      console.log('  2. Referenced components don\'t exist in the workspace');
      console.log('  3. Reference format is different than expected');
    }

    console.log('\n✨ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGraph();
