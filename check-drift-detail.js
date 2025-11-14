import { buildLocalGraph, getNode } from './packages/graph-core/dist/index.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';

async function checkDrift() {
  const componentKey = process.argv[2] || 'invalidate-cache';

  console.log(`🔍 Detailed Drift Analysis: ${componentKey}\n`);

  // Build local graph
  console.log('⏳ Building local graph...');
  const localGraph = await buildLocalGraph({
    basePath: '/Users/U05366/Documents/GitHub/vnext-sys-flow/core',
    computeHashes: true
  });
  console.log('✅ Local graph built\n');

  // Fetch runtime graph
  console.log('⏳ Fetching runtime graph...');
  const adapter = new AmorphieRuntimeAdapter();
  const runtimeGraph = await adapter.fetchGraph({
    baseUrl: 'http://localhost:4201',
    domain: 'core'
  }, { computeHashes: true });
  console.log('✅ Runtime graph fetched\n');

  // Find the component
  let localNode = null;
  let runtimeNode = null;

  for (const [id, node] of localGraph.nodes) {
    if (node.ref.key === componentKey) {
      localNode = node;
      console.log(`📦 Found in local: ${id}`);
      break;
    }
  }

  for (const [id, node] of runtimeGraph.nodes) {
    if (node.ref.key === componentKey) {
      runtimeNode = node;
      console.log(`📦 Found in runtime: ${id}`);
      break;
    }
  }

  if (!localNode) {
    console.log(`\n❌ Component '${componentKey}' not found in local graph`);
    return;
  }

  if (!runtimeNode) {
    console.log(`\n❌ Component '${componentKey}' not found in runtime graph`);
    return;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📋 COMPONENT METADATA');
  console.log('═══════════════════════════════════════\n');

  console.log(`Component: ${localNode.ref.key}`);
  console.log(`Type: ${localNode.type}`);
  console.log(`Domain: ${localNode.ref.domain}`);
  console.log(`Flow: ${localNode.ref.flow}`);
  console.log(`Version: ${localNode.ref.version}\n`);

  console.log('═══════════════════════════════════════');
  console.log('🔑 HASH COMPARISON');
  console.log('═══════════════════════════════════════\n');

  console.log('API Hash (Interface/Contract):');
  console.log(`  Local:   ${localNode.apiHash || 'N/A'}`);
  console.log(`  Runtime: ${runtimeNode.apiHash || 'N/A'}`);
  console.log(`  Match:   ${localNode.apiHash === runtimeNode.apiHash ? '✅ YES' : '❌ NO (Breaking Change)'}\n`);

  console.log('Config Hash (Behavior/Metadata):');
  console.log(`  Local:   ${localNode.configHash || 'N/A'}`);
  console.log(`  Runtime: ${runtimeNode.configHash || 'N/A'}`);
  console.log(`  Match:   ${localNode.configHash === runtimeNode.configHash ? '✅ YES' : '❌ NO'}\n`);

  console.log('═══════════════════════════════════════');
  console.log('📄 LOCAL DEFINITION');
  console.log('═══════════════════════════════════════\n');
  console.log(JSON.stringify(localNode.definition, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('📄 RUNTIME DEFINITION');
  console.log('═══════════════════════════════════════\n');
  console.log(JSON.stringify(runtimeNode.definition, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('🔍 SOURCE INFORMATION');
  console.log('═══════════════════════════════════════\n');

  console.log('Local:');
  console.log(`  File: ${localNode.metadata?.filePath || 'N/A'}`);
  console.log(`  Source: ${localNode.source}`);

  console.log('\nRuntime:');
  console.log(`  Runtime ID: ${runtimeNode.metadata?.runtimeId || 'N/A'}`);
  console.log(`  ETag: ${runtimeNode.metadata?.etag || 'N/A'}`);
  console.log(`  State: ${runtimeNode.metadata?.currentState || 'N/A'}`);
  console.log(`  Status: ${runtimeNode.metadata?.status || 'N/A'}`);
  console.log(`  Data from Extension: ${runtimeNode.metadata?.dataFetchedFromExtension ? 'YES' : 'NO'}`);

  console.log('\n✨ Analysis complete!');
}

checkDrift().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
