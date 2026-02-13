import { build } from 'esbuild';
import { cp, mkdir, stat } from 'fs/promises';
import { dirname, resolve } from 'path';

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  external: ['vscode'],
  sourcemap: true
};

if (watch) {
  buildOptions.watch = {
    onRebuild(error) {
      console.log(error || 'rebuilt');
    }
  };
}

await build(buildOptions);

// After building, copy webview assets and JSON schema into the extension package
async function safeCopy(src, dest, opts = {}) {
  try {
    await mkdir(dirname(dest), { recursive: true });
    await cp(src, dest, opts);
    console.log(`Copied: ${src} -> ${dest}`);
  } catch (err) {
    console.warn(`Skipping copy ${src} -> ${dest}:`, err?.message || err);
  }
}

const root = resolve(import.meta.url.replace('file://', ''), '..');
const extDir = resolve(root);

// Copy webview dist into extension (so extension can load it at runtime)
const webviewSrc = resolve(extDir, '../webview/dist-web');
const webviewDest = resolve(extDir, 'dist-web');
try {
  await stat(webviewSrc);
  await safeCopy(webviewSrc, webviewDest, { recursive: true });
} catch {
  console.warn('Webview dist not found; run `npm run -w packages/webview build` first.');
}

// Verify that JSON schema files exist in schemas/ directory
// (extracted by `npm run -w packages/core extract-schemas` from @burgan-tech/vnext-schema)
const schemaFiles = [
  'workflow-definition.schema.json',
  'task-definition.schema.json',
  'schema-definition.schema.json',
  'view-definition.schema.json',
  'function-definition.schema.json',
  'extension-definition.schema.json',
  'core-schema.schema.json'
];

const schemasDir = resolve(extDir, 'schemas');
let schemaCount = 0;
for (const schemaFile of schemaFiles) {
  try {
    await stat(resolve(schemasDir, schemaFile));
    schemaCount++;
  } catch {
    console.warn(`Schema file missing: schemas/${schemaFile} — run: npm run -w packages/core extract-schemas`);
  }
}
console.log(`Verified ${schemaCount}/${schemaFiles.length} schema files in schemas/`);
