var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import { builtinModules } from 'module';
import path from 'path';
// All Node.js built-in modules
var nodeBuiltins = __spreadArray(__spreadArray([], builtinModules, true), builtinModules.map(function (m) { return "node:".concat(m); }), true);
// Native modules that should not be bundled
var nativeModules = [
    'better-sqlite3',
    'serialport',
    '@serialport/bindings-cpp',
    '@serialport/parser-byte-length',
];
export default defineConfig({
    // Use relative paths for Electron's file:// protocol
    base: './',
    plugins: [
        react(),
        electron([
            {
                entry: 'electron/main.ts',
                onstart: function (args) {
                    args.startup();
                },
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        minify: false,
                        rollupOptions: {
                            external: __spreadArray(__spreadArray([
                                'electron',
                                'dotenv'
                            ], nativeModules, true), nodeBuiltins, true),
                            output: {
                                format: 'cjs',
                            },
                        },
                    },
                },
            },
            {
                entry: 'electron/preload.ts',
                onstart: function (args) {
                    args.reload();
                },
                vite: {
                    build: {
                        outDir: 'dist-electron',
                        rollupOptions: {
                            external: __spreadArray(['electron'], nodeBuiltins, true),
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
