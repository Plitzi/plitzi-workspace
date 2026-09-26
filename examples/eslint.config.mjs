import globals from 'globals';
import tsEslint from 'typescript-eslint';

import sharedConfig from '../packages/sdk-shared/eslint.config.mjs';

/**
 * The examples are read and copied more than any other code here — by people starting a project, and by agents
 * learning what Plitzi code looks like — so they are held to the same rules as the packages. One config for all of
 * them: ESLint finds it from any example's folder, and each file is checked against the `tsconfig.json` of the
 * example it belongs to.
 */
export default tsEslint.config({
  extends: [sharedConfig],
  ignores: ['**/dist/**', '**/.sdk-plugins/**', '**/tmp/**', '**/*.d.ts'],
  languageOptions: {
    globals: { ...globals.browser, ...globals.node },
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname
    }
  },
  rules: {
    // Prose is most of what an example says, and prose has apostrophes: single quotes, unless a string holds one — the
    // choice Prettier makes, so `--fix` and the formatter agree instead of undoing each other.
    quotes: ['error', 'single', { avoidEscape: true }],
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
        // Everything Plitzi is one group in an example — the SDK, the server, the space it ships — after the rest.
        pathGroups: [
          { pattern: '@plitzi/**', group: 'internal' },
          { pattern: '@plitzi/*', group: 'internal' }
        ],
        pathGroupsExcludedImportTypes: ['type'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always'
      }
    ]
  }
});
