import sharedConfig from '../sdk-shared/eslint.config.mjs';
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
