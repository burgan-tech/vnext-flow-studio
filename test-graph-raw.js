#!/usr/bin/env node
/**
 * Raw test to see what's in the workflow definitions
 */

import { buildLocalGraph } from './packages/graph-core/dist/index.js';

async function testGraph() {
  console.log('🔍 Inspecting Workflow Structure\n');

  const targetPath = process.argv[2] || process.cwd();
  console.log(`Target path: ${targetPath}\n`);

  try {
    const graph = await buildLocalGraph({
      basePath: targetPath,
      computeHashes: true
    });

    // Find first workflow
    const workflow = Array.from(graph.nodes.values()).find(n => n.type === 'workflow');

    if (workflow) {
      console.log(`\n📋 Sample Workflow: ${workflow.id}`);
      console.log(`File path: ${workflow.metadata?.filePath}\n`);

      console.log('Raw definition structure:');
      console.log(JSON.stringify(workflow.definition, null, 2));
    } else {
      console.log('No workflows found!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGraph();
