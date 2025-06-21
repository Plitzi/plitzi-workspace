import sharedConfig from '@plitzi/sdk-shared/eslint.config.ts.mjs';
import tsEslint from 'typescript-eslint';

export default tsEslint.config({
  extends: [sharedConfig],
  languageOptions: {
    parserOptions: {
      projectService: {
        defaultProject: './tsconfig.app.json'
      },
      tsconfigRootDir: import.meta.dirname
    }
  },
  rules: {
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        pathGroups: [
          { pattern: '@plitzi/sdk-*/**', group: 'internal' },
          { pattern: '@plitzi/sdk-*', group: 'internal' },
          { pattern: '@pmodules/**', group: 'internal' },
          { pattern: '@pcomponents/**', group: 'internal' },
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
