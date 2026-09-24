import type { CreateAnswers, ProjectFiles } from './types';

/**
 * Prettier and ESLint, configured rather than mentioned.
 *
 * A generated project is somebody's starting point, and the first commit into it decides its style for good.
 * Leaving that to whatever each editor happens to do is how a repository ends up with a diff that is mostly
 * whitespace by the second week — so the scaffold takes the decision, in the shape Plitzi's own packages use.
 *
 * The two do different jobs and the split is deliberate: Prettier owns formatting and ESLint is told to stay out
 * of it (`eslint-config-prettier` turns off every rule the two could disagree about), so there is exactly one
 * answer to "how should this be laid out" and no fight between the tools on save.
 */

const prettierrc = (): string =>
  `${JSON.stringify(
    {
      printWidth: 120,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      trailingComma: 'none',
      arrowParens: 'avoid',
      endOfLine: 'lf'
    },
    null,
    2
  )}\n`;

/** What a project writes that is nobody's to format or lint: its builds, its authored documents, its test output. */
const PROJECT_OUTPUTS = ['dist', 'space', '.sdk-plugins', 'visual/.results', 'visual/screenshots'];

const prettierignore = (outputs: readonly string[]): string =>
  `${['node_modules', ...outputs.filter(output => output !== '.sdk-plugins')].join('\n')}\n`;

/**
 * Flat config, and only what earns its place.
 *
 * Type-checked rules are on (`recommendedTypeChecked`), which is the reason this is worth having at all: they are
 * the ones that read the types rather than the text, and they catch the floating promise and the unsafe `any`
 * that no amount of formatting would have shown. `eslintConfigPrettier` goes last, so it can switch off the
 * stylistic rules the earlier entries turned on.
 */
const eslintConfig = (globals: 'node' | 'browser', outputs: readonly string[]): string => `import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tsEslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tsEslint.config(
  { ignores: [${outputs.map(output => `'${output}'`).join(', ')}] },
  js.configs.recommended,
  {
    /**
     * The type-checked rules, scoped to the files a type checker can actually see.
     *
     * Applied at the top level instead, they are also applied to this config file and to any plain \`.js\` — and
     * a rule that needs types, on a file with no program behind it, is not a lint error but a crash before the
     * first file is read.
     */
    files: ['**/*.{ts,tsx}'],
    extends: [tsEslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.${globals} },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    }
  },
  {
    // The rules of hooks are not a style preference: a component that calls one conditionally is broken at run
    // time, and a plugin is a component like any other.
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules
  },
  {
    // Playwright's specs run in Node and are not part of the app's own program.
    files: ['visual/**/*.ts', '*.config.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' }
  },
  eslintConfigPrettier
);
`;

/** The three files for code that runs where `globals` says, with `outputs` left alone. */
export const qualityFilesFor = (globals: 'node' | 'browser', outputs: readonly string[]): ProjectFiles => ({
  '.prettierrc': prettierrc(),
  '.prettierignore': prettierignore(outputs),
  'eslint.config.mjs': eslintConfig(globals, outputs)
});

export const qualityFiles = ({ mode }: CreateAnswers): ProjectFiles =>
  qualityFilesFor(mode === 'server' ? 'node' : 'browser', PROJECT_OUTPUTS);
