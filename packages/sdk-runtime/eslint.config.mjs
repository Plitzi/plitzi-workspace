import tsEslint from 'typescript-eslint';

import sharedConfig from '../sdk-shared/eslint.config.mjs';

export default tsEslint.config(
  {
    extends: [sharedConfig],
    languageOptions: {
      parserOptions: {
        projectService: {
          defaultProject: './tsconfig.json'
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    /**
     * What runs a space's own code holds nothing of what holds a run and its secrets (docs/en/server-packages.md, D4): it imports neither
     * the page server nor the actions engine, not even their types. What both sides speak is `@plitzi/sdk-shared/functions`.
     */
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@plitzi/sdk-server', '@plitzi/sdk-server/*', '@plitzi/sdk-actions', '@plitzi/sdk-actions/*'],
              message:
                "What runs a space's own code imports nothing of the host that holds the run (docs/en/server-packages.md, D4): what both " +
                'sides speak is @plitzi/sdk-shared/functions.'
            }
          ]
        }
      ]
    }
  }
);
