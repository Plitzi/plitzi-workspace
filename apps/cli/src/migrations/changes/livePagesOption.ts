import type { Migration, MigrationPlace } from '../types';

/** Only in a file that imports the server: a project's own `devReload` is not the server's option. */
const importsServer = (text: string): boolean => /from\s*['"]@plitzi\/sdk-server(\/[\w/-]+)?['"]/.test(text);

const everyWord = /\bdevReload\b/g;

/**
 * The server's `devReload` is `livePages`: the open pages now hear more than "load again" — the new documents of the
 * space they show, swapped where they stand — and a server that is not developing uses it too
 * (`createAuthoringHost`). A rename with no alias, written where the file imports `@plitzi/sdk-server`.
 */
export const livePagesOption: Migration = {
  id: 'livePagesOption',
  since: '0.38.18',
  scope: 'always',
  start:
    () =>
    ({ text }) => {
      if (!importsServer(text)) {
        return Promise.resolve([]);
      }

      const places: MigrationPlace[] = [...text.matchAll(everyWord)].map(match => ({
        line: text.slice(0, match.index).split('\n').length,
        what: 'devReload of @plitzi/sdk-server is livePages — renamed with no alias',
        edit: { start: match.index, end: match.index + 'devReload'.length, text: 'livePages' }
      }));

      return Promise.resolve(places);
    }
};
