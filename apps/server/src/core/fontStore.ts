import fs from 'node:fs';
import path from 'node:path';

import type { SpaceFont } from '@plitzi/sdk-shared';

/** One file in the store, as the caller needs to address it afterwards. */
export type StoredFont = {
  /** Store-relative, and exactly what goes into a `hosted` font's `files[].path`. */
  path: string;
  size: number;
  format: 'woff2' | 'woff';
};

/**
 * Where a deployment keeps the font files a space uploaded.
 *
 * Deliberately not a URL builder: addressing is `fontUrlResolver(baseUrl)`, which every render surface already
 * shares, and a store that also decided URLs would put this deployment's origin inside a document that travels to
 * other deployments (see `HostedFont`). Nor does it read bytes back — a local store's files are served off disk by
 * `fontAssetsStage` and a cloud store's by its CDN, so nothing would ever call it.
 */
export type FontStore = {
  list: (spaceId: number) => Promise<StoredFont[]>;
  put: (spaceId: number, file: { name: string; body: Buffer; format: 'woff2' | 'woff' }) => Promise<StoredFont>;
  remove: (storePath: string) => Promise<void>;
};

/** `<spaceId>/<name>` — the space segment is what keeps one space's files out of another's. */
const storePathOf = (spaceId: number, name: string): string => `${spaceId}/${name}`;

/**
 * A path that came from a document or a request, resolved inside the store and nowhere else.
 *
 * The manifest is data a user can write, so `..` and absolute paths reach here; without this check a font path
 * would be a way to read any file the process can.
 */
const resolveInside = (rootDir: string, storePath: string): string | undefined => {
  const resolvedRoot = path.resolve(rootDir);
  const filePath = path.resolve(resolvedRoot, storePath);

  return filePath.startsWith(resolvedRoot + path.sep) ? filePath : undefined;
};

/**
 * The store a self-hosted server gets for nothing: a directory on its own disk, served by this server at
 * `/fonts/*`. No object storage, no credentials, no account — and it works with no network at all, which is the
 * state a self-hosted deployment is allowed to be in.
 */
export const createLocalFontStore = (rootDir: string): FontStore => ({
  list: spaceId => {
    const dir = path.resolve(rootDir, String(spaceId));
    if (!fs.existsSync(dir)) {
      return Promise.resolve([]);
    }

    return Promise.resolve(
      fs
        .readdirSync(dir)
        .filter(name => name.endsWith('.woff2') || name.endsWith('.woff'))
        .map(name => ({
          path: storePathOf(spaceId, name),
          size: fs.statSync(path.join(dir, name)).size,
          format: name.endsWith('.woff2') ? ('woff2' as const) : ('woff' as const)
        }))
    );
  },

  put: (spaceId, file) => {
    const dir = path.resolve(rootDir, String(spaceId));
    fs.mkdirSync(dir, { recursive: true });
    const filePath = resolveInside(rootDir, storePathOf(spaceId, file.name));
    if (!filePath) {
      return Promise.reject(new Error('Font name escapes the store'));
    }

    fs.writeFileSync(filePath, file.body);

    return Promise.resolve({ path: storePathOf(spaceId, file.name), size: file.body.byteLength, format: file.format });
  },

  remove: storePath => {
    const filePath = resolveInside(rootDir, storePath);
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return Promise.resolve();
  }
});

/** Every store path a manifest names, so a deployment can tell what is still referenced from what is orphaned. */
export const hostedPathsOf = (fonts: SpaceFont[]): string[] =>
  fonts.flatMap(font => (font.source === 'hosted' ? font.files.map(file => file.path) : []));
