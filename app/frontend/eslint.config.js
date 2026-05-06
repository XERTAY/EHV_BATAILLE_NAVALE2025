import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import nodePlugin from 'eslint-plugin-n'
import promisePlugin from 'eslint-plugin-promise'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'

const reactRecommended = reactPlugin.configs.flat?.recommended ?? {
  plugins: { react: reactPlugin },
  rules: reactPlugin.configs.recommended.rules,
}
const reactJsxRuntime = reactPlugin.configs.flat?.['jsx-runtime'] ?? {
  rules: reactPlugin.configs['jsx-runtime'].rules,
}

const importGroups = [
  'builtin',
  'external',
  'internal',
  'parent',
  'sibling',
  'index',
]

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactRecommended,
      reactJsxRuntime,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      importPlugin.flatConfigs.recommended,
      promisePlugin.configs['flat/recommended'],
      nodePlugin.configs['flat/recommended-module'],
    ],
    plugins: {
      'unused-imports': unusedImports,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // -- Limites de complexite (warn pendant les phases d'extraction, error en fin de Phase 6)
      complexity: ['warn', 12],
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 5],
      'no-magic-numbers': 'off',

      // -- React strict (mais R3F-friendly : props 3D non traditionnelles)
      'react/prop-types': 'off',
      'react/no-unknown-property': 'off',
      'react/jsx-key': 'error',
      'react/jsx-no-leaked-render': 'warn',
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-useless-fragment': 'warn',
      'react/self-closing-comp': 'error',
      'react/no-unescaped-entities': 'warn',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',

      // -- Hooks (warn pendant l'extraction, sera passe en error en Phase 6)
      'react-hooks/exhaustive-deps': 'warn',
      // Plusieurs hooks legacy/extraits utilisent des patterns que le React
      // Compiler signale (memoization manuelle, setState synchrones, recursion).
      // Ils seront nettoyes a la Phase 6/7 ; on n'echoue pas le build dessus.
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/component-hook-factories': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/config': 'warn',
      'react-hooks/gating': 'warn',
      'react-hooks/no-deriving-state-in-effects': 'warn',
      'react-hooks/memoized-effect-dependencies': 'warn',
      'react-hooks/automatic-effect-dependencies': 'warn',

      // -- Accessibilite (warn pendant l'extraction)
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',

      // -- Imports
      'import/order': [
        'warn',
        {
          groups: importGroups,
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-default-export': 'off',
      'import/no-unresolved': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/named': 'off',
      'unused-imports/no-unused-imports': 'error',
      // Pendant les phases d'extraction le code legacy reste en place : warn (passera en error a la fin).
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^([A-Z_]|set[A-Z])',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // -- Divers
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-empty': ['error', { allowEmptyCatch: true }],

      // -- node plugin (assoupli pour browser/Vite)
      'n/no-missing-import': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-extraneous-import': 'off',
    },
  },
  {
    files: ['*.config.js', 'vite.config.js', 'eslint.config.js'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['src/main.jsx'],
    rules: {
      'max-lines': 'off',
    },
  },
])
