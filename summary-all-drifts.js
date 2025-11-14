import { buildLocalGraph } from './packages/graph-core/dist/index.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';

async function summarizeDrifts() {
  console.log('🔍 Comprehensive Drift Summary\n');

  // Build local graph
  const localGraph = await buildLocalGraph({
    basePath: '/Users/U05366/Documents/GitHub/vnext-sys-flow/core',
    computeHashes: true
  });

  // Fetch runtime graph
  const adapter = new AmorphieRuntimeAdapter();
  const runtimeGraph = await adapter.fetchGraph({
    baseUrl: 'http://localhost:4201',
    domain: 'core'
  }, { computeHashes: true });

  const localIds = new Set(localGraph.nodes.keys());
  const runtimeIds = new Set(runtimeGraph.nodes.keys());
  const inBoth = Array.from(localIds).filter(id => runtimeIds.has(id));

  const drifts = [];
  const unchanged = [];

  for (const id of inBoth) {
    const localNode = localGraph.nodes.get(id);
    const runtimeNode = runtimeGraph.nodes.get(id);

    const apiDrift = localNode.apiHash !== runtimeNode.apiHash;
    const configDrift = localNode.configHash !== runtimeNode.configHash;

    if (apiDrift || configDrift) {
      drifts.push({
        id,
        key: localNode.ref.key,
        type: localNode.type,
        apiDrift,
        configDrift,
        localApi: localNode.apiHash?.substring(0, 12),
        runtimeApi: runtimeNode.apiHash?.substring(0, 12),
        localConfig: localNode.configHash?.substring(0, 12),
        runtimeConfig: runtimeNode.configHash?.substring(0, 12)
      });
    } else {
      unchanged.push(localNode.ref.key);
    }
  }

  console.log('═══════════════════════════════════════');
  console.log('📊 DRIFT SUMMARY');
  console.log('═══════════════════════════════════════\n');

  console.log(`Total components in both: ${inBoth.length}`);
  console.log(`Components with drift: ${drifts.length}`);
  console.log(`Unchanged: ${unchanged.length}\n`);

  if (drifts.length > 0) {
    console.log('═══════════════════════════════════════');
    console.log('⚠️  COMPONENTS WITH DRIFT');
    console.log('═══════════════════════════════════════\n');

    // Group by type
    const byType = {};
    for (const drift of drifts) {
      if (!byType[drift.type]) {
        byType[drift.type] = [];
      }
      byType[drift.type].push(drift);
    }

    for (const [type, items] of Object.entries(byType)) {
      console.log(`\n${type.toUpperCase()}S (${items.length}):`);
      console.log('─'.repeat(50));

      for (const item of items) {
        console.log(`\n  ${item.key}`);
        if (item.apiDrift) {
          console.log(`    ⚠️  API: ${item.localApi}... → ${item.runtimeApi}...`);
        }
        if (item.configDrift) {
          console.log(`    📝 Config: ${item.localConfig}... → ${item.runtimeConfig}...`);
        }
      }
    }
  }

  if (unchanged.length > 0) {
    console.log('\n\n═══════════════════════════════════════');
    console.log('✅ UNCHANGED COMPONENTS');
    console.log('═══════════════════════════════════════\n');
    console.log(unchanged.join(', '));
  }

  console.log('\n\n═══════════════════════════════════════');
  console.log('💡 ANALYSIS');
  console.log('═══════════════════════════════════════\n');

  const apiDriftCount = drifts.filter(d => d.apiDrift).length;
  const configOnlyDriftCount = drifts.filter(d => !d.apiDrift && d.configDrift).length;

  console.log(`Breaking changes (API drift): ${apiDriftCount}`);
  console.log(`Non-breaking changes (Config only): ${configOnlyDriftCount}`);
  console.log(`False positives eliminated: ${unchanged.length} components match exactly`);

  console.log('\n✨ Summary complete!');
}

summarizeDrifts().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
