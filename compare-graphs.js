import { AmorphieLocalAdapter } from './packages/graph-core/dist/adapters/AmorphieLocalAdapter.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';
import { compareGraphs } from './packages/graph-core/dist/graph/Compare.js';

const localAdapter = new AmorphieLocalAdapter();
const runtimeAdapter = new AmorphieRuntimeAdapter();

console.log('🔍 Building Local and Runtime Graphs\n');

// Fetch local graph
console.log('📂 Building local graph from vnext-sys-flow/core...');
const localGraph = await localAdapter.fetchGraph({
  workspacePath: '/Users/U05366/Documents/GitHub/vnext-sys-flow/core',
  includeTypes: ['workflow', 'task', 'schema', 'view', 'function', 'extension']
}, { computeHashes: true });

console.log(`✅ Local: ${localGraph.nodes.size} components, ${localGraph.edges.size} dependencies\n`);

// Fetch runtime graph
console.log('📡 Fetching runtime graph from localhost:4201...');
const runtimeGraph = await runtimeAdapter.fetchGraph({
  baseUrl: 'http://localhost:4201',
  domain: 'core'
}, {
  computeHashes: true,
  includeTypes: ['workflow', 'task', 'schema', 'view', 'function', 'extension']
});

console.log(`✅ Runtime: ${runtimeGraph.nodes.size} components, ${runtimeGraph.edges.size} dependencies\n`);

// Compare graphs
console.log('🔄 Comparing local vs runtime...\n');
const diff = compareGraphs(localGraph, runtimeGraph);

console.log('═══════════════════════════════════════');
console.log('📊 GRAPH COMPARISON SUMMARY');
console.log('═══════════════════════════════════════\n');

console.log(`Missing in Runtime: ${diff.missingInTarget.length}`);
console.log(`Added in Runtime: ${diff.addedInTarget.length}`);
console.log(`Modified (API changes): ${diff.modified.filter(m => m.apiChanged).length}`);
console.log(`Modified (Config changes): ${diff.modified.filter(m => m.configChanged).length}`);
console.log(`Unchanged: ${diff.unchanged.length}\n`);

if (diff.missingInTarget.length > 0) {
  console.log('═══════════════════════════════════════');
  console.log('❌ MISSING IN RUNTIME');
  console.log('═══════════════════════════════════════\n');
  diff.missingInTarget.forEach(id => {
    const node = localGraph.nodes.get(id);
    console.log(`  ${id}`);
    console.log(`    Type: ${node.type}`);
    console.log(`    Label: ${node.label}`);
    console.log(`    API Hash: ${node.apiHash?.substring(0, 12)}...`);
    console.log('');
  });
}

if (diff.addedInTarget.length > 0) {
  console.log('═══════════════════════════════════════');
  console.log('✨ ADDED IN RUNTIME');
  console.log('═══════════════════════════════════════\n');
  diff.addedInTarget.forEach(id => {
    const node = runtimeGraph.nodes.get(id);
    console.log(`  ${id}`);
    console.log(`    Type: ${node.type}`);
    console.log(`    Label: ${node.label}`);
    console.log(`    State: ${node.metadata?.currentState || 'unknown'}`);
    console.log('');
  });
}

if (diff.modified.length > 0) {
  console.log('═══════════════════════════════════════');
  console.log('🔄 MODIFIED COMPONENTS');
  console.log('═══════════════════════════════════════\n');
  diff.modified.forEach(change => {
    const localNode = localGraph.nodes.get(change.id);
    const runtimeNode = runtimeGraph.nodes.get(change.id);

    console.log(`  ${change.id}`);
    console.log(`    Type: ${localNode.type}`);

    if (change.apiChanged) {
      console.log(`    ⚠️  API CHANGED (Breaking)`);
      console.log(`      Local:   ${localNode.apiHash?.substring(0, 12)}...`);
      console.log(`      Runtime: ${runtimeNode.apiHash?.substring(0, 12)}...`);
    }

    if (change.configChanged) {
      console.log(`    📝 Config Changed`);
      console.log(`      Local:   ${localNode.configHash?.substring(0, 12)}...`);
      console.log(`      Runtime: ${runtimeNode.configHash?.substring(0, 12)}...`);
    }

    console.log('');
  });
}

console.log('═══════════════════════════════════════');
console.log('✨ ANALYSIS');
console.log('═══════════════════════════════════════\n');

const needsDeployment = diff.missingInTarget.length + diff.modified.filter(m => m.apiChanged || m.configChanged).length;
const breakingChanges = diff.modified.filter(m => m.apiChanged).length;

console.log(`Components needing deployment: ${needsDeployment}`);
console.log(`Breaking changes detected: ${breakingChanges}`);
console.log(`Drift detected: ${needsDeployment > 0 ? 'YES' : 'NO'}`);
