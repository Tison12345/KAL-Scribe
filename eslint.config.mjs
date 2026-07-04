// @ts-check
// Fallback config for workspace members that don't ship their own
// eslint.config.mjs (apps/api and apps/web have their own, closer configs
// that ESLint's flat-config resolution picks up instead of this one).
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
