import importPlugin from 'eslint-plugin-import';
import tsEslint from 'typescript-eslint';

import sharedConfig from '../packages/sdk-shared/eslint.config.mjs';

/** Specs reach into the page through `page.evaluate`, whose callback runs in the browser and is typed from the DOM
 *  lib rather than from anything the checker can follow back — so the rules that police unsafe values there fire on
 *  correct code. Everything else stays on. */
const specOverride = {
  files: ['tests/**/*.ts', 'helpers/**/*.ts'],
  rules: {
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off'
  }
};

/** Playwright hands every fixture a function conventionally named `use`, which the React plugin reads as the `use`
 *  hook being called outside a component. Renaming it to satisfy the rule would cost every Playwright reader the
 *  signature they know. */
const fixtureOverride = {
  files: ['fixtures/**/*.ts'],
  rules: {
    'react-hooks/rules-of-hooks': 'off'
  }
};

export default tsEslint.config(
  {
    extends: [sharedConfig],
    ignores: ['.artifacts/**', 'node_modules/**'],
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
  },
  specOverride,
  fixtureOverride
);
