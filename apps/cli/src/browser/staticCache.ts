import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { copyOf } from '../runs/core/paths';

import type { BrowserPage, PageRoute } from './index';

/**
 * What a page asks another site for that does not change while it is worked on — its pictures, fonts, styles and
 * media — kept on disk for every browser the CLI opens after. Each command launches a Chromium of its own, with no
 * cache: a run's home asked a CDN, YouTube and Google Fonts for 63 files on every load, 1.25 s where a warm one
 * takes 0.27 s, and a CDN that throttles a run's thousands of requests failed checks that had nothing to do with it.
 * The project's own files are never kept: they are what a task changes.
 */

/** The kinds of request kept: what another site serves as it is, never a page or an answer of its API. */
const KEPT_KINDS = new Set(['image', 'font', 'stylesheet', 'media']);

/** How long a kept file stands: a site copied, a font, a picture do not change within a run. */
export const STATIC_KEPT_MS = 6 * 60 * 60_000;

/** Past it a file is fetched each time, never kept: a video is no picture. */
const MOST_BYTES = 8 * 1024 * 1024;

/** Headers that describe the bytes as they came over the wire, not as they are kept: decoded, and whole. */
const WIRE_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

interface KeptMeta {
  at: string;
  status: number;
  headers: Record<string, string>;
}

const isKeptMeta = (value: unknown): value is KeptMeta =>
  isRecord(value) && typeof value.at === 'string' && typeof value.status === 'number' && isRecord(value.headers);

/** Where a project keeps them: the project's, also from a task's copy — every task reads what the others fetched. */
export const staticCacheDir = (root: string): string =>
  path.join(copyOf(root)?.root ?? root, PROJECT_TMP, 'plitzi-cache', 'http');

const keyOf = (url: string): string => createHash('sha256').update(url).digest('hex').slice(0, 32);

/** Written whole or not at all: two browsers keeping the same file never leave half of it. */
const writeAtomic = async (file: string, data: string | Uint8Array): Promise<void> => {
  const partial = `${file}.${String(process.pid)}.${String(Math.random()).slice(2)}`;
  await fs.writeFile(partial, data);
  await fs.rename(partial, file);
};

const readKept = async (
  dir: string,
  key: string,
  now: number
): Promise<{ meta: KeptMeta; body: Buffer } | undefined> => {
  try {
    const meta: unknown = JSON.parse(await fs.readFile(path.join(dir, `${key}.json`), 'utf-8'));
    if (!isKeptMeta(meta) || now - Date.parse(meta.at) >= STATIC_KEPT_MS) {
      return undefined;
    }

    return { meta, body: await fs.readFile(path.join(dir, `${key}.bin`)) };
  } catch {
    return undefined;
  }
};

/** One request of the page: answered from what is kept, or fetched, kept and answered — anything else let through. */
const answer = async (route: PageRoute, dir: string): Promise<void> => {
  const request = route.request();
  if (request.method() !== 'GET' || !KEPT_KINDS.has(request.resourceType())) {
    await route.fallback();

    return;
  }

  const key = keyOf(request.url());
  const kept = await readKept(dir, key, Date.now());
  if (kept) {
    await route.fulfill({ status: kept.meta.status, headers: kept.meta.headers, body: kept.body });

    return;
  }

  const response = await route.fetch();
  const body = await response.body();
  const headers = Object.fromEntries(
    Object.entries(response.headers()).filter(([name]) => !WIRE_HEADERS.has(name.toLowerCase()))
  );
  if (response.status() === 200 && body.byteLength <= MOST_BYTES) {
    await fs.mkdir(dir, { recursive: true });
    await writeAtomic(path.join(dir, `${key}.bin`), body);
    await writeAtomic(
      path.join(dir, `${key}.json`),
      JSON.stringify({ at: new Date().toISOString(), status: 200, headers } satisfies KeptMeta)
    );
  }

  await route.fulfill({ status: response.status(), headers, body });
};

/**
 * Keeps what `page` asks other sites for in `dir`: every request whose origin is not `own` — the project's server,
 * whose files are never kept; none, for another site's page, whose own pictures and fonts are kept too (its page
 * itself, and what its scripts fetch, never are). Registered before any handler that stands in for a request.
 */
export const keepStatic = (page: BrowserPage, dir: string, own?: string): Promise<void> =>
  page.route(
    url => url.origin !== own,
    async route => {
      try {
        await answer(route, dir);
      } catch {
        // The page closed under it, or the site did not answer: nothing to keep, and nothing the page still waits on
        // that a second answer would reach — a request already answered or let through throws here too.
        await route.fallback().catch(() => undefined);
      }
    }
  );
