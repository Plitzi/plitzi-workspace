import importPlugin from 'eslint-plugin-import';
import tsEslint from 'typescript-eslint';

import sharedConfig from '../../packages/sdk-shared/eslint.config.mjs';

export default tsEslint.config({
  extends: [sharedConfig],
  languageOptions: {
    parserOptions: {
      projectService: {
        defaultProject: './tsconfig.json'
      },
      tsconfigRootDir: import.meta.dirname
    }
  },
  plugins: {
    import: importPlugin
  },
  rules: {
    // The whole point of the split: this package pulls the HTTP kernel and nothing else. The root barrel of
    // sdk-server re-exports SSR, RSC, plugins and the React render path, and ESM re-exports load eagerly — one
    // import from it would drag all of that back into an MCP process. Keep it unreachable, not discouraged.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@plitzi/sdk-server',
            message: 'Import from @plitzi/sdk-server/kernel — the root barrel loads the SSR/React graph.'
          }
        ]
      }
    ],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        pathGroups: [
          { pattern: '@plitzi/sdk-*/**', group: 'internal' },
          { pattern: '@plitzi/sdk-*', group: 'internal' },
          { pattern: '@pmodules/**', group: 'internal' },
          { pattern: '@pcomponents/**', group: 'internal' }
          // { pattern: '@icons/**', group: 'internal' },
          // { pattern: '@hooks/**', group: 'internal' },
          // { pattern: '@/**', group: 'internal' } // , position: 'before'
        ],
        pathGroupsExcludedImportTypes: ['type'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always'
      }
    ]
  }
});
