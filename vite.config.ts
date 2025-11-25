import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { builtinModules } from 'module';
import path from 'path';

// All Node.js built-in modules
const nodeBuiltins = [...builtinModules, ...builtinModules.map(m => `node:${m}`)];

export default defineConfig({
  // Use relative paths for Electron's file:// protocol
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(args) {
          args.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            minify: false,
            rollupOptions: {
              external: [
                'electron',
                'better-sqlite3',
                'dotenv',
                ...nodeBuiltins,
              ],
              output: {
                format: 'cjs',
                // Ensure electron is required correctly
                interop: 'auto',
              },
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron', ...nodeBuiltins],
              output: {
                format: 'cjs',
                interop: 'auto',
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
