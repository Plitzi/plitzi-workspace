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
  'src/author.ts',
  'src/main.ts',
  'src/preflight.css',
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
  'src/plugins/README.md',
  'src/plugins/assets.d.ts',
  'src/functions/README.md',
  'src/actions/README.md',
  'src/connectors/README.md',
  '.yarnrc.yml',
  'pnpm-workspace.yaml'
]);
