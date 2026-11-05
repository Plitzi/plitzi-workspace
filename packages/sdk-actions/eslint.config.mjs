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
     * What holds a run and its secrets imports nothing of what runs a space's own code (RFC 0032, D4), nor the page
     * server: a worker installs neither. What both sides speak is `@plitzi/sdk-shared/functions`.
     */
    files: ['src/**/*.ts'],
    // Its tests drive the engine with the isolates it is handed in production: they ship with neither.
    ignores: ['**/*.test.ts', '**/tests/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@plitzi/sdk-server', '@plitzi/sdk-server/*', '@plitzi/sdk-runtime', '@plitzi/sdk-runtime/*'],
              message:
                "The actions engine imports nothing of what runs a space's code, nor the page server (RFC 0032, D4): " +
                'what both sides speak is @plitzi/sdk-shared/functions; a runner is handed to it.'
            }
          ]
        }
      ]
    }
  }
);
