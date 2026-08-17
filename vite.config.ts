import { defineConfig, type UserConfig } from 'vite-plus';

import oxfmtConfig from './.oxfmtrc.json' with { type: 'json' };

const fmt = oxfmtConfig as NonNullable<UserConfig['fmt']>;

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  fmt,
  lint: {
    ignorePatterns: ['**/dist/**', '**/coverage/**', '**/routeTree.gen.ts'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ['apps/api/**'],
        env: { node: true },
        rules: {
          'typescript/no-explicit-any': 'off',
          'typescript/no-floating-promises': 'warn',
          'typescript/no-unsafe-argument': 'warn',
        },
      },
      {
        files: ['apps/api/**/*.spec.ts', 'apps/api/**/*.e2e-spec.ts', 'apps/api/test/**'],
        plugins: ['jest'],
        env: { node: true, jest: true },
      },
    ],
  },
  run: {
    cache: true,
  },
});
