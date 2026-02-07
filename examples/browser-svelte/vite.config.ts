import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    svelte(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      'deepagents': path.resolve(__dirname, '../../libs/deepagents/src/index.ts'),
      'buffer': 'buffer/',
      'path': 'pathe',
      'node:async_hooks': path.resolve(__dirname, '../browser-sandbox/src/mock-async-hooks.ts'),
      'node:zlib': path.resolve(__dirname, '../browser-sandbox/src/mock-zlib.ts'),
      'node:module': path.resolve(__dirname, '../browser-sandbox/src/mock-module.ts'),
      'node:fs': path.resolve(__dirname, '../browser-sandbox/src/mock-fs.ts'),
      'node:fs/promises': path.resolve(__dirname, '../browser-sandbox/src/mock-fs.ts'),
      'node:os': path.resolve(__dirname, '../browser-sandbox/src/mock-os.ts'),
      'node:child_process': path.resolve(__dirname, '../browser-sandbox/src/mock-child_process.ts'),
      'fast-glob': path.resolve(__dirname, '../browser-sandbox/src/mock-fast-glob.ts'),
    },
  },
  build: {
    target: 'esnext'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  worker: {
    format: 'es',
    plugins: () => [
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ]
  }
})
