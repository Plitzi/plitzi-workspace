import { readFileSync } from 'node:fs';

/**
 * Skips writing a declaration file whose content is already on disk.
 *
 * Every build regenerates every `.d.ts` in `dist`, unchanged ones included — a few hundred per package. That is what
 * makes VS Code fall over on a rebuild: editors resolve `@plitzi/*` through package.json `exports`, so the language
 * server is holding those generated declarations open, and replacing all of them at once forces it to re-parse and
 * re-check the whole graph while you are typing.
 *
 * (The tidier fix would be to have TypeScript read the sources instead, through the project-reference redirect. It
 * does not fire here: the reference resolves, but the mapping from `dist/**.d.ts` back to `src` never matches, and
 * the `paths` + `baseUrl` route is dead because `baseUrl` is deprecated in TypeScript 6. Not writing files nobody
 * changed is smaller, and it helps every consumer — including the other repository, which cannot use `paths` at all.)
 *
 * Pass as `beforeWriteFile` to the dts plugin. A typical edit then rewrites the handful of declarations that
 * actually changed instead of all of them.
 */
export const skipUnchangedDts = (filePath, content) => {
  try {
    if (readFileSync(filePath, 'utf8') === content) {
      return false;
    }
  } catch {
    // Not there yet — first build, or a new module. Write it.
  }
};
