#!/usr/bin/env node

/**
 * extract-schemas.js
 *
 * Extracts JSON Schema definitions from @burgan-tech/vnext-schema npm package
 * and writes them to packages/extension/schemas/ for VS Code IntelliSense.
 *
 * Usage:
 *   node packages/core/scripts/extract-schemas.js
 *
 * The schema files are used by the extension's registerJsonSchemas() function
 * to provide autocomplete, validation, and hover documentation in JSON editors.
 */

const fs = require('fs');
const path = require('path');

// Resolve paths relative to the monorepo root
const scriptDir = __dirname;
const coreDir = path.resolve(scriptDir, '..');
const monorepoRoot = path.resolve(coreDir, '../..');
const schemasOutputDir = path.resolve(monorepoRoot, 'packages/extension/schemas');

// Color helpers for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bright: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  log('\n📦 Extracting JSON Schemas from @burgan-tech/vnext-schema...\n', 'bright');

  // 1. Load the vnext-schema package
  let vnextSchema;
  try {
    vnextSchema = require('@burgan-tech/vnext-schema');
  } catch (error) {
    log('❌ Cannot find @burgan-tech/vnext-schema package.', 'red');
    log('   Run: npm install --save-dev @burgan-tech/vnext-schema', 'yellow');
    log('   Error: ' + error.message, 'dim');
    process.exit(1);
  }

  // 2. Get available types
  const allTypes = vnextSchema.getAvailableTypes();
  log(`Found ${allTypes.length} schema types: ${allTypes.join(', ')}`, 'cyan');

  // We only need the 6 component types that map to vnext directories
  // (core and header are internal, not directly used for file validation)
  const componentTypes = ['workflow', 'task', 'schema', 'view', 'function', 'extension'];
  const typesToExtract = componentTypes.filter(t => allTypes.includes(t));

  if (typesToExtract.length === 0) {
    log('❌ No matching component schemas found!', 'red');
    process.exit(1);
  }

  // 3. Ensure output directory exists
  if (!fs.existsSync(schemasOutputDir)) {
    fs.mkdirSync(schemasOutputDir, { recursive: true });
    log(`Created output directory: ${schemasOutputDir}`, 'dim');
  }

  // 4. Extract and write each schema
  let extracted = 0;

  for (const schemaType of typesToExtract) {
    try {
      const schema = vnextSchema.getSchema(schemaType);

      if (!schema) {
        log(`  ⚠ No schema returned for type: ${schemaType}`, 'yellow');
        continue;
      }

      // Ensure schema has proper $id and title for VS Code IntelliSense
      const enrichedSchema = {
        ...schema,
        $schema: schema.$schema || 'http://json-schema.org/draft-07/schema#',
        $id: schema.$id || `https://vnext.io/schemas/${schemaType}-definition.schema.json`,
        title: schema.title || `vNext ${capitalize(schemaType)} Definition`,
        description: schema.description || `JSON Schema for vNext ${capitalize(schemaType)} component files`
      };

      const fileName = `${schemaType}-definition.schema.json`;
      const filePath = path.join(schemasOutputDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify(enrichedSchema, null, 2) + '\n', 'utf8');

      const fileSizeKB = (Buffer.byteLength(JSON.stringify(enrichedSchema, null, 2)) / 1024).toFixed(1);
      const propCount = Object.keys(schema.properties || {}).length;
      const reqCount = (schema.required || []).length;

      log(`  ✅ ${fileName} (${fileSizeKB} KB, ${propCount} properties, ${reqCount} required)`, 'green');
      extracted++;
    } catch (error) {
      log(`  ❌ Failed to extract schema for ${schemaType}: ${error.message}`, 'red');
    }
  }

  // Also extract core schema (used as base for all components)
  if (allTypes.includes('core')) {
    try {
      const coreSchema = vnextSchema.getSchema('core');
      if (coreSchema) {
        const fileName = 'core-schema.schema.json';
        const filePath = path.join(schemasOutputDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(coreSchema, null, 2) + '\n', 'utf8');
        log(`  ✅ ${fileName} (core/base schema)`, 'green');
        extracted++;
      }
    } catch (error) {
      log(`  ⚠ Core schema extraction optional: ${error.message}`, 'yellow');
    }
  }

  // 5. Summary
  log(`\n📊 Extracted ${extracted} schema(s) to:`, 'bright');
  log(`   ${schemasOutputDir}\n`, 'cyan');

  if (extracted === 0) {
    log('❌ No schemas extracted!', 'red');
    process.exit(1);
  }

  log('✅ Schema extraction complete!\n', 'green');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
