import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Alias deepagents to the source directory in the monorepo
      'deepagents': path.resolve(__dirname, '../../libs/deepagents/src/index.ts'),
      'node:async_hooks': path.resolve(__dirname, 'src/mock-async-hooks.ts'),
      'node:zlib': path.resolve(__dirname, 'src/mock-zlib.ts'),
      'node:module': path.resolve(__dirname, 'src/mock-module.ts'),
      'node:fs': path.resolve(__dirname, 'src/mock-fs.ts'),
      'node:fs/promises': path.resolve(__dirname, 'src/mock-fs.ts'),
      'node:os': path.resolve(__dirname, 'src/mock-os.ts'),
      'node:child_process': path.resolve(__dirname, 'src/mock-child_process.ts'),
      'fast-glob': path.resolve(__dirname, 'src/mock-fast-glob.ts'),
    },
  },
  define: {
    // For packages that expect process.env
    'process.env': {},
  },
  build: {
    target: 'esnext'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  }
})
