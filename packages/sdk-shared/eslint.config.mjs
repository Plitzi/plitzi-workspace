import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tsEslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import prettier from 'eslint-plugin-prettier';
import storybook from 'eslint-plugin-storybook';
import importEslint from 'eslint-plugin-import';
import { globalIgnores } from 'eslint/config';

export default tsEslint.config(
  {
    extends: [js.configs.recommended, ...tsEslint.configs.strictTypeChecked, globalIgnores(['**/*.js'])],
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'node_modules',
      'node_modules/*',
      './node_modules/**',
      '**/node_modules/**',
      'dist',
      'coverage',
      '.yarn/*'
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['.storybook/*.ts', '.storybook/*.tsx'],
          defaultProject: './tsconfig.json'
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      import: importEslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
      prettier,
      jsxRuntime: react.configs.flat['jsx-runtime'],
      storybook
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // One rule evaluator for every reader: sdk-shared's (`@plitzi/sdk-shared/conditions`). plitzi-ui keeps a copy of its
      // own, which Plitzi never reads, so the builder's preview and the server cannot decide a condition two ways.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@plitzi/plitzi-ui/QueryBuilder/evaluator',
              message: 'Evaluate a condition with `evaluateRuleGroup` from `@plitzi/sdk-shared/conditions`.'
            },
            {
              name: '@plitzi/plitzi-ui/QueryBuilder',
              importNames: ['QueryBuilderEvaluator'],
              message: 'Evaluate a condition with `evaluateRuleGroup` from `@plitzi/sdk-shared/conditions`.'
            },
            {
              name: '@plitzi/plitzi-ui/QueryBuilder/helpers',
              importNames: ['QueryBuilderEvaluator'],
              message: 'Evaluate a condition with `evaluateRuleGroup` from `@plitzi/sdk-shared/conditions`.'
            }
          ]
        }
      ],
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-useless-default-assignment': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          disallowTypeAnnotations: false,
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports'
        }
      ],
      '@typescript-eslint/no-unnecessary-type-arguments': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false, arguments: false } }
      ],
      '@typescript-eslint/no-confusing-void-expression': 'off', // ['error', { ignoreArrowShorthand: true, ignoreVoidOperator: true }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-var': 'error',
      // A file is read whole — by a person, and by an agent before it changes it: past this, it is split by what changes
      // together. A project's own files are held to the same idea by `plitzi lint` (`file-too-long`, `MAX_LINES`).
      'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
      curly: 'error',
      // indent: ['warn', 2],
      'linebreak-style': ['error', 'unix'],
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: false }],
      // semi: ['warn', 'never'],
      'react/jsx-key': ['warn', { checkFragmentShorthand: true }],
      'react-hooks/refs': 'off', // @todo: review later
      'react-hooks/immutability': 'off', // @todo: review later
      'react-hooks/set-state-in-effect': 'off', // @todo: review later
      'react-hooks/preserve-manual-memoization': 'off', // @todo: review later
      // sdk-elements' memos that the page server, which draws once, makes as values (`Element/hooks/drawnMemo.ts`).
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useDrawnMemo|useDrawnCallback)' }],
      'prettier/prettier': ['warn', { trailingComma: 'none' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Destructuring a key out so the rest carries everything else is how a field is dropped from an object here.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [
            { pattern: '@plitzi/+(sdk-*|nexus)/**', group: 'internal' },
            { pattern: '@plitzi/+(sdk-*|nexus)', group: 'internal' }
            // { pattern: '@icons/**', group: 'internal' },
            // { pattern: '@components/**', group: 'internal' },
            // { pattern: '@hooks/**', group: 'internal' },
            // { pattern: '@/**', group: 'internal' } // , position: 'before'
          ],
          pathGroupsExcludedImportTypes: ['type'],
          alphabetize: { order: 'asc', caseInsensitive: true },
          'newlines-between': 'always'
        }
      ]
    }
  },
  /**
   * Where a file exports more than components on purpose, and Fast Refresh reloads it whole: an element's file exports
   * its component and what declares it (its definition, its settings), read together by the registry; a model's form
   * exports the form and its schema; an entry point and an MCP app's view export what their bundle is. Said here once,
   * per folder, instead of a comment in each file.
   */
  {
    files: ['src/index.tsx', 'src/**/elements/**/*.tsx', 'src/**/[mM]odels/**/*.tsx', 'src/**/apps/*/view/index.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' }
  }
);
