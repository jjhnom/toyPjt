import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // This project uses plain CSS; do not search parent workspaces for PostCSS config.
  css: { postcss: {} },
  // Phaser is the only browser runtime dependency. Avoid scanning authoring HTML
  // and generated reports when starting the development server.
  optimizeDeps: { noDiscovery: true, include: ['phaser'] },
  server: {
    host: true,
    port: 5173,
    // Test reports and native/authoring output are not browser source files.
    watch: { ignored: ['**/artifacts/**', '**/android/**', '**/.agent/**', '**/.agents/**'] }
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  }
});
