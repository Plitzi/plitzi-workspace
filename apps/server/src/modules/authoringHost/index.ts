import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { createServer } from '../../core/createServer';
import { PREVIEW_TOKEN_PARAM, readDraftToken } from '../../core/previewToken';
import { serverLog } from '../../helpers/serverLog';

import type { ServerConfig } from '../../core/createServer';
import type { AuthoredDocuments } from '../project/watchSpace';
import type { DraftStore, OfflineDataRaw, SSRServer, SSRSpaceDeployment } from '@plitzi/sdk-shared';

/**
 * Pages somebody else authored — an agent designing a screen, a visitor's own page — served as a project's pages are,
 * each at an address of its own, from one server.
 *
 * Each page is a space kept as a draft of the host's one space (`?__pt=<id>`), which is how a page server tells many
 * apart on one host: the page arrives with its whole space in it, every page after it is the browser's, and a reload
 * that lost the address finds it again in the draft's cookie. So a page here is drawn in the browser alone — no server
 * provider, action, function or channel of its own: it is data and its look.
 *
 * Author them where they cannot reach anything (`authorIsolated` of `@plitzi/sdk-authoring/node`) and serve them here,
 * on an origin of their own — never the app's, whose cookies a page somebody else wrote would then run beside.
 *
 * ```ts
 * const host = createAuthoringHost({ dir: 'tmp/pages', port: 8091, frameAncestors: ['https://localhost:8080'] });
 * await host.server.listen(8091, '0.0.0.0');
 *
 * const result = await authorIsolated('tmp/pages/weather.ts');
 * if (result.ok) {
 *   const { path } = host.put(result.space, { id: 'weather' });   // `/?__pt=weather`
 * }
 * ```
 */

export type AuthoringHostConfig = Omit<ServerConfig, 'adapters' | 'auth' | 'draftStore'> & {
  /** Where the pages are kept, `<id>.json` each — read back when the host starts, so a restart serves them still. */
  dir: string;
  /** Who may show the pages in an iframe, as CSP `frame-ancestors` sources: the app that shows them. */
  frameAncestors?: string[];
};

export type AuthoringHost = {
  server: SSRServer;
  /**
   * Keeps a space under `id` — a new one when left out, which nobody can guess — replacing what it held, and answers
   * the address its pages are at: its home is `path`, any other page that path with the page's own in front of `?`.
   */
  put: (documents: AuthoredDocuments, options?: { id?: string }) => { id: string; path: string };
  /** Forgets a page: its address answers 404 from then on. Whether there was one. */
  drop: (id: string) => boolean;
  /** The ids it serves. */
  ids: () => string[];
};

/** The one space the host serves, which every page is a draft of. */
const SPACE_ID = 1;

/** An id is a file's name and a query's value: nothing that could be read as a path or need escaping. */
const ID = /^[\w-]{1,64}$/;

/** A day: how long a browser remembers which page it was looking at, for a reload that lost the address. */
const SESSION_TTL_MS = 86_400_000;

const isDocuments = (value: unknown): value is OfflineDataRaw =>
  isRecord(value) && isRecord(value.schema) && isRecord(value.style);

/** The pages `dir` holds — what is not one is said, and left where it is. */
const readPages = (dir: string): Map<string, OfflineDataRaw> => {
  const pages = new Map<string, OfflineDataRaw>();
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json'))) {
    const id = file.slice(0, -'.json'.length);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'));
    } catch {
      parsed = undefined;
    }

    if (ID.test(id) && isDocuments(parsed)) {
      pages.set(id, { schema: parsed.schema, style: parsed.style });
    } else {
      serverLog.warn('AuthoringHost', `${path.join(dir, file)} is not a page this host wrote: left out`);
    }
  }

  return pages;
};

export const createAuthoringHost = ({ dir, frameAncestors, ...config }: AuthoringHostConfig): AuthoringHost => {
  mkdirSync(dir, { recursive: true });
  const pages = readPages(dir);
  const fileOf = (id: string): string => path.join(dir, `${id}.json`);

  const keep = (id: string, data: OfflineDataRaw): void => {
    writeFileSync(fileOf(id), JSON.stringify({ schema: data.schema, style: data.style }));
    pages.set(id, { schema: data.schema, style: data.style });
  };

  const drop = (id: string): boolean => {
    if (!pages.delete(id)) {
      return false;
    }

    rmSync(fileOf(id), { force: true });

    return true;
  };

  // Every page is a reusable draft that never lapses: it is served until it is dropped.
  const draftStore: DraftStore = {
    put: (token, data) => {
      if (ID.test(token)) {
        keep(token, data);
      }
    },
    take: token => {
      const data = pages.get(token);

      return data ? { data, reusable: true, spaceId: SPACE_ID } : undefined;
    },
    drop: token => {
      drop(token);
    }
  };

  const deployment: SSRSpaceDeployment = {
    spaceId: SPACE_ID,
    environment: 'main',
    revision: 0,
    ...(frameAncestors ? { frameAncestors } : {})
  };

  const server = createServer({
    ...config,
    preview: { sessionTtlMs: SESSION_TTL_MS, ...config.preview },
    draftStore,
    adapters: {
      // The space every page is a draft of has nothing of its own to draw.
      getOfflineData: () => Promise.resolve(undefined),
      getSpaceDeployment: req => {
        const id = readDraftToken(req);
        if (id === undefined) {
          return Promise.resolve({
            error: {
              code: 404,
              message: `Nothing here: each page of this host is at the address put() answered — /?${PREVIEW_TOKEN_PARAM}=<id>`
            }
          });
        }

        if (!pages.has(id)) {
          return Promise.resolve({
            error: { code: 404, message: `No page "${id}" here: put() it, or it was dropped` }
          });
        }

        return Promise.resolve(deployment);
      }
    }
  });

  return {
    server,
    put: (documents, { id = randomBytes(16).toString('base64url') } = {}) => {
      if (!ID.test(id)) {
        throw new Error(`A page id is letters, digits, "-" and "_", up to 64 of them — not "${id}"`);
      }

      keep(id, documents);

      return { id, path: `/?${PREVIEW_TOKEN_PARAM}=${id}` };
    },
    drop,
    ids: () => [...pages.keys()]
  };
};
