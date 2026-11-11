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
  // `no-restricted-paths` judges an import by the file it resolves to: the CLI's relative imports name no extension.
  settings: { 'import/resolver': { node: { extensions: ['.ts', '.tsx', '.js', '.mjs'] } } },
  rules: {
    // The harness — `src/runs/`, what several agents on one project run on — is loaded by the run's commands alone
    // (`commands/runs/`, through `register/commands.ts`), in a chunk of its own: a command of one agent never reads it.
    // What both use lives outside it (`core/`, `copies/`). `import()` counts as an import.
    'import/no-restricted-paths': [
      'error',
      {
        basePath: import.meta.dirname,
        zones: [
          {
            target: [
              'src/!(*.test).ts',
              'src/!(runs|tests|commands)/**/!(*.test).ts',
              'src/commands/!(runs)/**/!(*.test).ts'
            ],
            from: 'src/runs',
            message:
              'The harness is loaded by the run commands alone (commands/runs). Move what this needs out of src/runs — to core/ or copies/ — or load it from commands/runs.'
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
          { pattern: '@plitzi/sdk-*', group: 'internal' }
        ],
        pathGroupsExcludedImportTypes: ['type'],
        alphabetize: { order: 'asc', caseInsensitive: true },
        'newlines-between': 'always'
      }
    ]
  }
});
