import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';

async function checkSchemaStates() {
  console.log('🔍 Schema Instance States\n');

  const adapter = new AmorphieRuntimeAdapter();
  const runtimeGraph = await adapter.fetchGraph({
    baseUrl: 'http://localhost:4201',
    domain: 'core'
  }, { computeHashes: false, includeTypes: ['schema'] });

  console.log(`Found ${runtimeGraph.nodes.size} schemas in runtime\n`);

  console.log('═══════════════════════════════════════');
  console.log('SCHEMA STATES');
  console.log('═══════════════════════════════════════\n');

  for (const [id, node] of runtimeGraph.nodes) {
    if (node.type !== 'schema') continue;

    console.log(`📋 ${node.ref.key}`);
    console.log(`   Runtime ID: ${node.metadata?.runtimeId}`);
    console.log(`   Current State: ${node.metadata?.currentState || 'null'}`);
    console.log(`   Status: ${node.metadata?.status || 'null'}`);
    console.log(`   Data from Extension: ${node.metadata?.dataFetchedFromExtension ? 'YES' : 'NO'}`);
    console.log(`   Has Definition: ${node.definition ? 'YES' : 'NO'}`);
    console.log(`   Definition Size: ${JSON.stringify(node.definition).length} bytes`);
    console.log();
  }

  console.log('═══════════════════════════════════════');
  console.log('💡 ANALYSIS');
  console.log('═══════════════════════════════════════\n');

  const allNull = Array.from(runtimeGraph.nodes.values()).every(n =>
    n.type !== 'schema' || n.metadata?.currentState === null || n.metadata?.currentState === undefined
  );

  if (allNull) {
    console.log('✅ All schemas have currentState = null');
    console.log('   This means schemas do NOT use workflow lifecycle states.');
    console.log('   They are stored as plain data, not in draft/active state machine.');
  } else {
    console.log('⚠️  Some schemas have lifecycle states');
  }
}

checkSchemaStates().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
