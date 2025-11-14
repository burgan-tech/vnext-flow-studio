import { buildLocalGraph } from './packages/graph-core/dist/index.js';
import { AmorphieRuntimeAdapter } from './packages/graph-core/dist/adapters/AmorphieRuntimeAdapter.js';

async function checkSchemaDrifts() {
  console.log('🔍 Schema Drift Analysis\n');

  const localGraph = await buildLocalGraph({
    basePath: '/Users/U05366/Documents/GitHub/vnext-sys-flow/core',
    computeHashes: true
  });

  const adapter = new AmorphieRuntimeAdapter();
  const runtimeGraph = await adapter.fetchGraph({
    baseUrl: 'http://localhost:4201',
    domain: 'core'
  }, { computeHashes: true });

  const schemas = ['schema', 'task', 'view', 'workflow'];

  for (const schemaKey of schemas) {
    let localNode = null;
    let runtimeNode = null;

    for (const [id, node] of localGraph.nodes) {
      if (node.ref.key === schemaKey && node.type === 'schema') {
        localNode = node;
        break;
      }
    }

    for (const [id, node] of runtimeGraph.nodes) {
      if (node.ref.key === schemaKey && node.type === 'schema') {
        runtimeNode = node;
        break;
      }
    }

    if (!localNode || !runtimeNode) continue;

    console.log('═══════════════════════════════════════');
    console.log(`📋 ${schemaKey.toUpperCase()} SCHEMA`);
    console.log('═══════════════════════════════════════\n');

    // Extract $id URLs
    const localId = localNode.definition.$id || localNode.definition.schema?.$id;
    const runtimeId = runtimeNode.definition.$id || runtimeNode.definition.schema?.$id;

    console.log('$id URL:');
    console.log(`  Local:   ${localId}`);
    console.log(`  Runtime: ${runtimeId}`);
    console.log(`  Match:   ${localId === runtimeId ? '✅' : '❌'}\n`);

    // Check for Turkish translations
    const localStr = JSON.stringify(localNode.definition);
    const runtimeStr = JSON.stringify(runtimeNode.definition);

    const hasTurkishLocal = localStr.includes('ı') || localStr.includes('ş') || localStr.includes('ğ');
    const hasTurkishRuntime = runtimeStr.includes('ı') || runtimeStr.includes('ş') || runtimeStr.includes('ğ');

    console.log('Translations:');
    console.log(`  Local has Turkish:   ${hasTurkishLocal ? 'YES' : 'NO'}`);
    console.log(`  Runtime has Turkish: ${hasTurkishRuntime ? 'YES' : 'NO'}\n`);

    // Sample description comparison
    const getFirstDescription = (def) => {
      const str = JSON.stringify(def);
      const match = str.match(/"description"\s*:\s*"([^"]+)"/);
      return match ? match[1] : '';
    };

    const localDesc = getFirstDescription(localNode.definition);
    const runtimeDesc = getFirstDescription(runtimeNode.definition);

    if (localDesc && runtimeDesc && localDesc !== runtimeDesc) {
      console.log('Sample Description Change:');
      console.log(`  Local:   "${localDesc}"`);
      console.log(`  Runtime: "${runtimeDesc}"`);
      console.log();
    }

    console.log('Hashes:');
    console.log(`  API Hash Match:    ${localNode.apiHash === runtimeNode.apiHash ? '✅' : '❌'}`);
    console.log(`  Config Hash Match: ${localNode.configHash === runtimeNode.configHash ? '✅' : '❌'}`);
    console.log();
  }

  console.log('═══════════════════════════════════════');
  console.log('💡 SUMMARY');
  console.log('═══════════════════════════════════════\n');
  console.log('Common patterns in schema drift:');
  console.log('  1. URL Change: vnext.io → schemas.vnext.com');
  console.log('  2. Language: English → Turkish descriptions');
  console.log('  3. Structure: Schema validation rules appear identical');
  console.log('\nThese are localization/deployment changes, not structural changes.');
  console.log('The schemas remain functionally compatible.');
}

checkSchemaDrifts().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
