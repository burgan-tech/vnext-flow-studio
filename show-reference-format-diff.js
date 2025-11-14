import { buildLocalGraph } from './packages/graph-core/dist/index.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';

async function showReferenceDiff() {
  console.log('🔍 Reference Format Comparison\n');

  const localGraph = await buildLocalGraph({
    basePath: '/Users/U05366/Documents/GitHub/vnext-sys-flow/core',
    computeHashes: true
  });

  const adapter = new AmorphieRuntimeAdapter();
  const runtimeGraph = await adapter.fetchGraph({
    baseUrl: 'http://localhost:4201',
    domain: 'core'
  }, { computeHashes: true });

  // Check sys-flows
  const localNode = localGraph.nodes.get('core/sys-flows/sys-flows@1.0.0');
  const runtimeNode = runtimeGraph.nodes.get('core/sys-flows/sys-flows@1.0.0');

  if (!localNode || !runtimeNode) {
    console.log('Component not found');
    return;
  }

  console.log('═══════════════════════════════════════');
  console.log('LOCAL: Schema Reference in Start Transition');
  console.log('═══════════════════════════════════════\n');
  console.log(JSON.stringify(localNode.definition.startTransition.schema, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('RUNTIME: Schema Reference in Start Transition');
  console.log('═══════════════════════════════════════\n');
  console.log(JSON.stringify(runtimeNode.definition.startTransition.schema, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('LOCAL: Task Reference in First Transition');
  console.log('═══════════════════════════════════════\n');
  const localTask = localNode.definition.states[0].transitions[0].onExecutionTasks[0].task;
  console.log(JSON.stringify(localTask, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('RUNTIME: Task Reference in First Transition');
  console.log('═══════════════════════════════════════\n');
  const runtimeTask = runtimeNode.definition.states[0].transitions[0].onExecutionTasks[0].task;
  console.log(JSON.stringify(runtimeTask, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('💡 FINDING');
  console.log('═══════════════════════════════════════\n');
  console.log('The drift is caused by different reference formats:');
  console.log('  • Local uses file paths: { "ref": "Tasks/invalidate-cache.json" }');
  console.log('  • Runtime uses structured refs: { "key": "...", "domain": "...", ... }');
  console.log('\nThis is a normalization issue - both reference the same component,');
  console.log('just in different formats. The runtime has resolved the file references.');
}

showReferenceDiff().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
