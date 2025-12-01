const { ComponentResolver } = require('./packages/core/dist/model/ComponentResolver.js');
const path = require('path');

async function testMapperResolution() {
  console.log('Testing Mapper Component Resolution...\n');

  const resolver = new ComponentResolver({
    basePath: path.join(__dirname, 'test-mappers')
  });

  // Test 1: Resolve by key
  console.log('Test 1: Resolving mapper by key reference');
  const mapper1 = await resolver.resolveMapper({
    key: 'order-mapper',
    domain: 'ecommerce',
    flow: 'mappers',
    version: '1.0.0'
  });
  console.log('✓ Result:', mapper1 ? `Found ${mapper1.key}` : 'Not found');

  // Test 2: Scan for mappers
  console.log('\nTest 2: Scanning for all mapper components');
  const components = await resolver.scanForComponents();
  const mappers = components.filter(c => c.contractType || c.handlers);
  console.log(`✓ Found ${mappers.length} mapper(s):`);
  mappers.forEach(m => {
    console.log(`  - ${m.domain}/${m.flow}/${m.key}@${m.version} (${m.contractType || 'unknown'})`);
  });

  // Test 3: Check platform schema resolution
  console.log('\nTest 3: Platform schema resolution');
  const { resolvePlatformSchema } = require('./packages/core/dist/mapper/platformSchemas.js');
  const schema = resolvePlatformSchema('platform://ScriptContext');
  console.log('✓ ScriptContext schema:', schema ? 'Loaded' : 'Not found');
  if (schema) {
    console.log(`  Properties: ${Object.keys(schema.properties || {}).join(', ')}`);
  }
}

testMapperResolution().catch(console.error);
