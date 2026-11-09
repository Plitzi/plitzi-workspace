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
     * The kernel takes nothing from another Plitzi package but its types (RFC 0032, D3): a value import of one would
     * load it into every process built on this, the functions runner's included.
     */
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/tests/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@plitzi/sdk-server',
                '@plitzi/sdk-server/*',
                '@plitzi/sdk-actions',
                '@plitzi/sdk-actions/*',
                '@plitzi/sdk-runtime',
                '@plitzi/sdk-runtime/*',
                '@plitzi/sdk-mcp',
                '@plitzi/sdk-mcp/*'
              ],
              message:
                "The kernel is below every server package, types included (RFC 0032, D3): a type it needs is its own, or sdk-shared's."
            },
            {
              group: [
                '@plitzi/*',
                '!@plitzi/sdk-server',
                '!@plitzi/sdk-server/*',
                '!@plitzi/sdk-actions',
                '!@plitzi/sdk-actions/*',
                '!@plitzi/sdk-runtime',
                '!@plitzi/sdk-runtime/*',
                '!@plitzi/sdk-mcp',
                '!@plitzi/sdk-mcp/*'
              ],
              allowTypeImports: true,
              message: 'The kernel imports only types from another Plitzi package (RFC 0032, D3).'
            }
          ]
        }
      ]
    }
  }
);
