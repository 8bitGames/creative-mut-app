import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { builtinModules } from 'module';
import path from 'path';

// All Node.js built-in modules
const nodeBuiltins = [...builtinModules, ...builtinModules.map(m => `node:${m}`)];

// Native modules that should not be bundled
const nativeModules = [
  'better-sqlite3',
  'serialport',
  '@serialport/bindings-cpp',
  '@serialport/parser-byte-length',
  'electron-store',
];

export default defineConfig({
  // Use relative paths for Electron's file:// protocol
  base: './',
  plugins: [
    react(),
    // Electron plugin
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
                'dotenv',
                ...nativeModules,
                ...nodeBuiltins,
              ],
              output: {
                format: 'cjs',
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
