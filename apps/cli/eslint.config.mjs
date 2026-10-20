import importPlugin from 'eslint-plugin-import';
import tsEslint from 'typescript-eslint';

import sharedConfig from '../../packages/sdk-shared/eslint.config.mjs';

export default tsEslint.config({
  extends: [sharedConfig],
  languageOptions: {
    parserOptions: {
      projectService: { defaultProject: './tsconfig.json' },
      tsconfigRootDir: import.meta.dirname
    }
  },
  plugins: { import: importPlugin },
  rules: {
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        pathGroups: [
          { pattern: '@plitzi/sdk-*/**', group: 'internal' },
          { pattern: '@plitzi/sdk-*', group: 'internal' }
        ],
        pathGroupsExcludedImportTypes: ['type'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always'
      }
    ]
  }
});
