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
    // A file is read whole — by a person, and by an agent before it changes it: past this, it is split by what changes
    // together (the CLI holds a project's own files to the same, `MAX_LINES`).
    'max-lines': ['error', { max: 600, skipBlankLines: true, skipComments: true }],
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
