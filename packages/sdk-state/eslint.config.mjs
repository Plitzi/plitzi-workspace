import sharedConfig from '@plitzi/sdk-shared/eslint.config.ts.mjs';
import tsEslint from 'typescript-eslint';

export default tsEslint.config({
  extends: [sharedConfig],
  languageOptions: {
    parserOptions: {
      projectService: {
        defaultProject: './tsconfig.json'
      },
      tsconfigRootDir: import.meta.dirname
    }
  }
});
