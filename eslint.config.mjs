import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'packages/assets/clips/**',
      'packages/demo/public/**',
      'docs/**',
      // Session state beside the sources. Unlike Prettier, ESLint does not read
      // `.gitignore`, so without these lines `eslint .` in the main checkout descends
      // into every worktree under `.worktrees/` and lints a second, potentially stale
      // copy of the whole repository — measured, not assumed.
      '.worktrees/**',
      '.waves/**',
      '.superpowers/**',
      '.probe/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser }, globals: { ...globals.browser } },
  },
  // The workspace scripts run under Node, and ESLint's default environment knows neither
  // `console` nor `process`; declaring the runtime here is what keeps `no-undef` on
  // everywhere instead of switching it off to silence these exact errors.
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Unreachable as written here: with `exactOptionalPropertyTypes: true` the
      // `LooseRequired` inside Vue's `InferDefault` strips `undefined`, so an explicit
      // `default: undefined` on an optional prop fails vue-tsc with TS2379 — observed on
      // all five optional props of LoopedLoader, and no type-true default exists for
      // `manifest: unknown` (only `(props) => {}` is assignable, not `() => undefined`).
      // The props are optional in the type, so `undefined` already is their contract.
      'vue/require-default-prop': 'off',
    },
  },
  prettier,
)
