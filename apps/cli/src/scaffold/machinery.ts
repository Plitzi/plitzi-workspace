import { CLI_DIR, FUNCTIONS_DIR, MAIN_FILE } from './paths';

/**
 * The files of a project that are this CLI's machinery rather than the project's own: what `plitzi upgrade` keeps up
 * with the CLI. Named, not inferred, so a file the scaffold starts a project with — its space, pages, plugins, data,
 * README, `.env` — can never be taken for one: those are the project's from the moment they are written.
 *
 * `package.json` is not among them: it is merged, never replaced (`upgrade packages`). Nor are the skills, which come
 * from the packages installed (`upgrade skills`).
 *
 * Nor are they the project's to format: the generated `.prettierignore` names them, so `npm run format` leaves them as
 * the CLI wrote them and `upgrade` still knows them for its own.
 */
export const MACHINERY: ReadonlySet<string> = new Set([
  // The entry point, in `src/` where one is looked for — and the CLI's folder, all of it.
  MAIN_FILE,
  `${CLI_DIR}/author.ts`,
  `${CLI_DIR}/preflight.css`,
  `${CLI_DIR}/assets.d.ts`,
  `${CLI_DIR}/README.md`,
  // What the tools find at the project's root.
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.build.json',
  '.gitignore',
  'AGENTS.md',
  'CLAUDE.md',
  '.prettierrc',
  '.prettierignore',
  'eslint.config.mjs',
  'playwright.config.ts',
  'visual/home.spec.ts',
  '.yarnrc.yml',
  'pnpm-workspace.yaml',
  // The folders of `src/` a script watches, kept there while they are empty.
  'src/plugins/.gitkeep',
  `${FUNCTIONS_DIR}/.gitkeep`,
  'src/connectors/.gitkeep'
]);

/**
 * Machinery an older CLI wrote and this one no longer does, by the machinery file that read it: `plitzi upgrade` removes
 * one nobody changed since, once the file that read it is the CLI's current one — beside a reader the project made its
 * own, it is still read, and stays. One the project changed is its own, shown and left.
 */
export const RETIRED_MACHINERY: Readonly<Record<string, string>> = {
  // `.env` is read as the scripts start now (`--env-file-if-exists`, `start:dev`'s preload), before any module is.
  'src/env.ts': MAIN_FILE
};
