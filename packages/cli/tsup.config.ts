import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  clean: true,
  sourcemap: true,
  dts: true,
  shims: false,
  noExternal: ['@error2fix/core'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
