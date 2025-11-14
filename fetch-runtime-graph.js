import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';
import { getGraphStats } from './packages/graph-core/dist/index.js';

async function fetchRuntimeGraph() {
  console.log('🔍 Fetching Runtime Graph\n');

  const adapter = new AmorphieRuntimeAdapter();

  // Use the configured local environment
  const env = {
    id: 'local',
    name: 'Local Development',
    baseUrl: 'http://localhost:4201',
    domain: 'core'
  };

  try {
    console.log(`Connecting to: ${env.baseUrl}`);
    console.log(`Domain: ${env.domain}\n`);

    const graph = await adapter.fetchGraph(env, {
      computeHashes: true
    });

    const stats = getGraphStats(graph);

    console.log('═══════════════════════════════════════');
    console.log('📊 RUNTIME GRAPH STATISTICS');
    console.log('═══════════════════════════════════════\n');

    console.log(`Total Components: ${stats.nodeCount}`);
    console.log(`Total Dependencies: ${stats.edgeCount}\n`);

    console.log('Components by Type:');
    for (const [type, count] of Object.entries(stats.nodesByType)) {
      console.log(`  ${type.padEnd(12)}: ${count}`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📦 COMPONENT DETAILS');
    console.log('═══════════════════════════════════════\n');

    // Group by type
    const byType = {
      workflow: [],
      task: [],
      schema: [],
      view: [],
      function: [],
      extension: []
    };

    for (const [id, node] of graph.nodes) {
      if (byType[node.type]) {
        byType[node.type].push(node);
      }
    }

    // Display each type
    for (const [type, nodes] of Object.entries(byType)) {
      if (nodes.length === 0) continue;

      console.log(`\n${type.toUpperCase()}S (${nodes.length}):`);
      console.log('─'.repeat(40));

      for (const node of nodes) {
        console.log(`\n  📦 ${node.ref.key}`);
        console.log(`     ID: ${node.id}`);
        console.log(`     Label: ${node.label || 'N/A'}`);
        console.log(`     Version: ${node.ref.version}`);

        if (node.metadata?.currentState) {
          console.log(`     State: ${node.metadata.currentState}`);
        }

        if (node.metadata?.status) {
          console.log(`     Status: ${node.metadata.status}`);
        }

        if (node.apiHash) {
          console.log(`     API Hash: ${node.apiHash.substring(0, 16)}...`);
        }

        // Show dependencies
        const outgoing = graph.outgoingEdges.get(node.id);
        if (outgoing && outgoing.length > 0) {
          console.log(`     Dependencies: ${outgoing.length}`);
          for (const edge of outgoing.slice(0, 3)) {
            const target = graph.nodes.get(edge.to);
            if (target) {
              console.log(`       → ${edge.type}: ${target.ref.key}`);
            }
          }
          if (outgoing.length > 3) {
            console.log(`       ... and ${outgoing.length - 3} more`);
          }
        }
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('✅ SUCCESS');
    console.log('═══════════════════════════════════════\n');

    console.log(`Fetched ${stats.nodeCount} components from runtime`);
    console.log(`Environment: ${env.name} (${env.baseUrl})`);

  } catch (error) {
    console.error('\n❌ Error fetching runtime graph:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

fetchRuntimeGraph();
