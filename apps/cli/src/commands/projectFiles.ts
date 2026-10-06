import path from 'node:path';

import { PROJECT_DATA_PREFIX } from '@plitzi/sdk-shared/server/rsc/projectData';

import { filesUnder } from './filesUnder';
import { DATA_DIR, PUBLIC_DIR } from '../scaffold/paths';

import type { Schema } from '@plitzi/sdk-shared';

/**
 * The files of a project that are neither code nor its space: its data (`src/data/`, read by its providers on the
 * server, never served) and what it serves to anyone (`public/`, of which `public/assets/` is what the space's CDN
 * holds) — and how the space's CDN addresses the project took are written back as they were.
 */

/** `path` as a whole token of the text: never the tail of an address that already holds it (`…/pizarra/assets/a.png`). */
export const tokenOf = (path: string): RegExp =>
  new RegExp(`(?<![\\w.:/-])${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`, 'g');

/**
 * The project's paths to the space's files put back as the addresses they have on its CDN. `create --from` and
 * `pull` write each CDN address as the project's own path (`/assets/a.png`, served from `public/`), and the space on
 * Plitzi serves no such path: sent as they are, its pictures and data would point at nothing.
 */
export const onItsCdn = (text: string, downloads: Readonly<Record<string, string>>): string =>
  Object.entries(downloads)
    .filter(([to]) => to.startsWith(`${PUBLIC_DIR}/`))
    .map(([to, url]) => [to.slice(PUBLIC_DIR.length), url] as const)
    .sort(([a], [b]) => b.length - a.length)
    .reduce((written, [project, url]) => written.replace(tokenOf(project), url), text);

/** Where a project keeps the files its space serves from the CDN: `public/assets/<path>` is `<space>/assets/<path>`. */
export const PUBLIC_ASSETS_DIR = `${PUBLIC_DIR}/assets`;

/** The data files of the project, by their path in it: every `.json` under `src/data/`. */
export const projectDataFiles = async (root: string): Promise<string[]> =>
  (await filesUnder(root, DATA_DIR)).filter(file => file.endsWith('.json')).sort();

/** The files of `public/assets/`, by their path in the project — never a folder's `.gitkeep`. */
export const projectAssetFiles = async (root: string): Promise<string[]> =>
  (await filesUnder(root, PUBLIC_ASSETS_DIR)).filter(file => path.basename(file) !== '.gitkeep').sort();

/** One provider reading a file of the project's data, with the file it names — relative to the data folder. */
export type DataRead = { elementId: string; query: string; file: string; server: boolean };

/**
 * Every provider that reads a file of the project's data: a `/data/<file>` query written as it is (no `{{token}}`), not
 * fed by a connector or an action — which publish their own answer, and read no file.
 */
export const dataReadsOf = (flat: Schema['flat']): DataRead[] =>
  Object.values(flat).flatMap(element => {
    const { query, connector, action } = element.attributes;
    const fed = [connector, action].some(value => typeof value === 'string' && value !== '');
    if (typeof query !== 'string' || !query.startsWith(PROJECT_DATA_PREFIX) || query.includes('{{') || fed) {
      return [];
    }

    return [
      {
        elementId: element.id,
        query,
        file: query.slice(PROJECT_DATA_PREFIX.length).split(/[?#]/)[0],
        server: element.definition.runtime === 'server'
      }
    ];
  });
