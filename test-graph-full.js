#!/usr/bin/env node
/**
 * Full detailed test showing all graph information
 */

import {
  buildLocalGraph,
  getGraphStats,
  getAllEdges,
  getNode,
  getDependents,
  getDependencies,
  getIncomingEdges,
  getOutgoingEdges
} from './packages/graph-core/dist/index.js';

async function testGraph() {
  console.log('🔍 Full Graph Analysis\n');

  const targetPath = process.argv[2] || process.cwd();
  console.log(`📁 Target: ${targetPath}\n`);

  try {
    console.log('⏳ Building graph with full hashing...\n');
    const graph = await buildLocalGraph({
      basePath: targetPath,
      computeHashes: true
    });

    const stats = getGraphStats(graph);
    const edges = getAllEdges(graph);

    // ========================================
    // OVERVIEW
    // ========================================
    console.log('═══════════════════════════════════════');
    console.log('📊 GRAPH OVERVIEW');
    console.log('═══════════════════════════════════════\n');

    console.log(`Total Components: ${stats.nodeCount}`);
    console.log(`Total Dependencies: ${stats.edgeCount}`);
    console.log(`Average Dependencies per Component: ${(stats.edgeCount / stats.nodeCount).toFixed(2)}\n`);

    console.log('Components by Type:');
    for (const [type, count] of Object.entries(stats.nodesByType)) {
      console.log(`  ${type.padEnd(12)} ${count}`);
    }

    // ========================================
    // SAMPLE NODES - DETAILED
    // ========================================
    console.log('\n═══════════════════════════════════════');
    console.log('🔖 SAMPLE COMPONENTS (Detailed)');
    console.log('═══════════════════════════════════════\n');

    const sampleNodes = Array.from(graph.nodes.values()).slice(0, 3);

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

      if (node.metadata?.filePath) {
        const fileName = node.metadata.filePath.split('/').pop();
        console.log(`   File: ${fileName}`);
      }

      // Show dependencies
      const outgoing = getOutgoingEdges(graph, node.id);
      const incoming = getIncomingEdges(graph, node.id);

      console.log(`   Dependencies: ${outgoing.length} outgoing, ${incoming.length} incoming`);

      if (outgoing.length > 0) {
        console.log(`   Depends on:`);
        for (const edge of outgoing.slice(0, 3)) {
          const target = getNode(graph, edge.to);
          console.log(`     → ${target?.ref.key || edge.to} (${edge.type})`);
        }
        if (outgoing.length > 3) {
          console.log(`     ... and ${outgoing.length - 3} more`);
        }
      }
    }

    // ========================================
    // EDGE ANALYSIS
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('🔗 DEPENDENCY ANALYSIS');
    console.log('═══════════════════════════════════════\n');

    // Count by type
    const edgesByType = {};
    for (const edge of edges) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    console.log('Dependencies by Type:');
    for (const [type, count] of Object.entries(edgesByType)) {
      console.log(`  ${type.padEnd(12)} ${count}`);
    }

    // ========================================
    // HIGH IMPACT COMPONENTS
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('⚠️  HIGH-IMPACT COMPONENTS');
    console.log('═══════════════════════════════════════\n');
    console.log('(Components with many dependents)\n');

    const impactMap = new Map();
    for (const node of graph.nodes.values()) {
      const dependents = getIncomingEdges(graph, node.id);
      if (dependents.length > 0) {
        impactMap.set(node.id, {
          node,
          dependentCount: dependents.length
        });
      }
    }

    const sortedImpact = Array.from(impactMap.values())
      .sort((a, b) => b.dependentCount - a.dependentCount)
      .slice(0, 10);

    if (sortedImpact.length > 0) {
      for (const { node, dependentCount } of sortedImpact) {
        console.log(`  ${node.ref.key.padEnd(40)} ${dependentCount} dependents`);
      }
    } else {
      console.log('  No high-impact components found');
    }

    // ========================================
    // WORKFLOW DEEP DIVE
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('🔄 WORKFLOW DEEP DIVE');
    console.log('═══════════════════════════════════════\n');

    const workflows = Array.from(graph.nodes.values())
      .filter(n => n.type === 'workflow')
      .slice(0, 2);

    for (const workflow of workflows) {
      console.log(`\n📋 ${workflow.id}`);
      console.log(`   Label: ${workflow.label || '(no label)'}`);

      const def = workflow.definition?.attributes || workflow.definition;
      if (def) {
        console.log(`   Type: ${def.type || '?'}`);
        console.log(`   States: ${def.states?.length || 0}`);

        // Count different types of dependencies
        const deps = getOutgoingEdges(graph, workflow.id);
        const depsByType = {};
        for (const dep of deps) {
          depsByType[dep.type] = (depsByType[dep.type] || 0) + 1;
        }

        console.log(`   Dependencies:`);
        if (Object.keys(depsByType).length > 0) {
          for (const [type, count] of Object.entries(depsByType)) {
            console.log(`     - ${count} ${type}(s)`);
          }
        } else {
          console.log(`     (none)`);
        }

        // Show workflow-level schema if exists
        if (def.schema) {
          console.log(`   Workflow Schema: ${def.schema.key || '?'}`);
        }

        // Show sample states with their dependencies
        if (def.states && def.states.length > 0) {
          console.log(`\n   Sample States:`);
          for (const state of def.states.slice(0, 3)) {
            console.log(`     • ${state.key} (type: ${state.stateType})`);

            // Show state-level dependencies
            const stateDeps = [];
            if (state.onEntries?.length > 0) {
              stateDeps.push(`${state.onEntries.length} onEntry task(s)`);
            }
            if (state.onExits?.length > 0) {
              stateDeps.push(`${state.onExits.length} onExit task(s)`);
            }
            if (state.view) {
              stateDeps.push('has view');
            }
            if (state.schema) {
              stateDeps.push('has schema');
            }

            if (stateDeps.length > 0) {
              console.log(`       Dependencies: ${stateDeps.join(', ')}`);
            }
          }
        }
      }

      // Show who depends on this workflow
      const dependents = getIncomingEdges(graph, workflow.id);
      if (dependents.length > 0) {
        console.log(`\n   Used by:`);
        for (const dep of dependents.slice(0, 3)) {
          const from = getNode(graph, dep.from);
          console.log(`     ← ${from?.ref.key || dep.from}`);
        }
        if (dependents.length > 3) {
          console.log(`     ... and ${dependents.length - 3} more`);
        }
      }
    }

    // ========================================
    // HASH INFORMATION
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('🔐 HASH INFORMATION (for drift detection)');
    console.log('═══════════════════════════════════════\n');

    const nodesWithHashes = Array.from(graph.nodes.values())
      .filter(n => n.apiHash || n.configHash)
      .slice(0, 5);

    console.log('Components with computed hashes:\n');
    for (const node of nodesWithHashes) {
      console.log(`  ${node.ref.key}`);
      if (node.apiHash) {
        console.log(`    API:    ${node.apiHash.substring(0, 16)}...`);
      }
      if (node.configHash) {
        console.log(`    Config: ${node.configHash.substring(0, 16)}...`);
      }
    }

    console.log('\n💡 These hashes enable:');
    console.log('   • API drift detection (breaking changes)');
    console.log('   • Config drift detection (business logic changes)');
    console.log('   • Version comparison between local/runtime');

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n\n═══════════════════════════════════════');
    console.log('✨ SUMMARY');
    console.log('═══════════════════════════════════════\n');

    console.log('Graph Successfully Built:');
    console.log(`  ✓ ${stats.nodeCount} components discovered`);
    console.log(`  ✓ ${stats.edgeCount} dependencies mapped`);
    console.log(`  ✓ ${nodesWithHashes.length} components hashed for drift detection`);
    console.log(`  ✓ ${sortedImpact.length} high-impact components identified`);

    console.log('\nNext Steps:');
    console.log('  1. Use VS Code extension: "Graph: Build Local Dependency Graph"');
    console.log('  2. Configure runtime environment: "Graph: Configure Environment"');
    console.log('  3. Fetch runtime graph: "Graph: Fetch Runtime Graph"');
    console.log('  4. Compare: "Graph: Compare Local vs Runtime"');
    console.log('  5. Impact analysis: "Graph: Analyze Component Impact"');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

testGraph();
