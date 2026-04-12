// // Packages
// import path from 'path';

// // Relatives
// import sharedConfig, { settings } from '@plitzi/sdk-shared/eslint.config.mjs';

// export default [
//   ...sharedConfig,
//   {
//     settings: {
//       ...settings,
//       'import/resolver': {
//         ...settings['import/resolver'],
//         alias: {
//           ...settings['import/resolver'].alias,
//           map: [
//             ...settings['import/resolver'].alias.map,
//             ['@modules', path.resolve('./src/modules')],
//             ['@components', path.resolve('./src/components')]
//           ]
//         }
//       }
//     },
//     ignores: ['**/node_modules/**', 'dist/**']
//   }
// ];

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
  rules: {
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        pathGroups: [
          { pattern: '@plitzi/sdk-*/**', group: 'internal' },
          { pattern: '@plitzi/sdk-*', group: 'internal' },
          { pattern: '@modules/**', group: 'internal' },
          { pattern: '@components/**', group: 'internal' }
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
