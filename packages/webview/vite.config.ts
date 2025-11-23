import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths instead of absolute paths for VS Code webviews
  build: {
    outDir: 'dist-web',
    // Disable module preload polyfill to prevent CSP issues in VS Code webviews
    modulePreload: { polyfill: false },
    manifest: true, // Generate manifest.json for asset mapping
    commonjsOptions: {
      include: [/@amorphie-flow-studio\/core/, /node_modules/]
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mapper: resolve(__dirname, 'mapper.html'),
        testRunner: resolve(__dirname, 'testRunner.html')
      }
    }
  },
  optimizeDeps: {
    include: ['@amorphie-flow-studio/core']
  }
});