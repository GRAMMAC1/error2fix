import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      server: './src/server.ts',
    },
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      dts: {
        bundle: true,
      },
      banner: {
        js: '#!/usr/bin/env node',
      },
    },
  ],
  output: {
    target: 'node',
    cleanDistPath: true,
    sourceMap: true,
  },
});
