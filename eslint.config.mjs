import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', '**/dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nodePlugin.configs['flat/recommended-module'],
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['test/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['packages/mcp/src/**/*.ts'],
    rules: {
      'n/no-missing-import': 'off',
    },
  },
  {
    files: ['packages/cli/src/**/*.ts'],
    rules: {
      'n/no-missing-import': 'off',
    },
  },
  {
    files: ['packages/*/tsup.config.ts'],
    rules: {
      'n/no-extraneous-import': 'off',
    },
  },
);
