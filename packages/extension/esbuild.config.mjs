import { build } from 'esbuild';

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