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

// Copy canonical schema into extension package so jsonValidation can resolve it
const schemaSrc = resolve(extDir, '../../schemas/schemas/workflow-definition.schema.json');
const schemaDest = resolve(extDir, 'schemas/workflow-definition.schema.json');
await safeCopy(schemaSrc, schemaDest);
