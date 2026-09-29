/// <reference types="vitest" />

import { createRequire } from 'node:module';

import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const PACKAGE = require('./package.json') as { version: string };

export default defineConfig({
  define: {
    VERSION: JSON.stringify(PACKAGE.version)
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    // The functions' isolates: isolated-vm needs Node's startup snapshot off (see sandbox/isolate.ts).
    execArgv: ['--no-node-snapshot'],
    deps: {
      inline: [/@plitzi\/sdk-.*/, '@modelcontextprotocol/sdk', 'zod']
    }
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mjs', '.js']
  }
});
