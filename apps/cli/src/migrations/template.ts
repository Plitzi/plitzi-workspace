import type { Migration, MigrationPlace } from './types';

/**
 * THE TEMPLATE FOR A NEW MIGRATION — not one: it lives beside the machinery, outside `changes/`, and nothing runs it but
 * its test. Copy it into `changes/` as a file named by what the release changes (`changes/snippetNames.ts`), its imports
 * from `../types`; set `id` to the file's name and `since` to the version the change ships in; write what it finds; list
 * it in `MIGRATIONS` (`index.ts`) after the newest; and copy `template.test.ts` beside it.
 * `docs/en/releases.md` § A change a project's source has to follow.
 *
 * This one is the commonest kind: an export a package renamed with no alias — `oldName` of `@plitzi/sdk-example`, now
 * `newName`. A rename has one right answer, so it has a `rewrite`; a change the author must decide (a default that
 * flipped) leaves `rewrite` out, and is said at its line and never written — `changes/folderImports.ts` is one.
 */

const PACKAGE = '@plitzi/sdk-example';
const FROM = 'oldName';
const TO = 'newName';

/** Only in a file that imports the name from the package: a project's own `oldName` is not the package's. */
const importsIt = (text: string): boolean =>
  new RegExp(`import\\s+(type\\s+)?\\{[^}]*\\b${FROM}\\b[^}]*\\}\\s*from\\s*['"]${PACKAGE}['"]`).test(text);

// Two: a `g` regex keeps `lastIndex` between `.test` calls, and would skip a line after a match.
const word = new RegExp(`\\b${FROM}\\b`);
const everyWord = new RegExp(`\\b${FROM}\\b`, 'g');

export const template: Migration = {
  id: 'template',
  since: '0.0.0',
  // A project upgraded at or after `since` was rewritten then: `always` is for what breaks whenever, see `Migration`.
  scope: 'until-upgraded',
  // Nothing to read once here; a migration that asks the install something reads it in `start`, before the finder.
  start:
    () =>
    ({ text }) => {
      if (!importsIt(text)) {
        return Promise.resolve([]);
      }

      const places: MigrationPlace[] = text
        .split('\n')
        .flatMap((line, index) =>
          word.test(line) ? [{ line: index + 1, what: `${FROM} of ${PACKAGE} is ${TO} — renamed with no alias` }] : []
        );

      return Promise.resolve(places);
    },
  rewrite: ({ text }) => text.replace(everyWord, TO)
};
