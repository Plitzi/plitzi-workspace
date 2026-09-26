import { randomBytes } from 'node:crypto';

import type { Redis } from 'ioredis';

/**
 * The pictures pasted onto boards, kept beside the boards they belong to and served by the example's own route
 * (`main.ts`). A board forgotten takes its pictures with it.
 *
 * Only what a browser shows as an image gets in, decided by the bytes rather than by what the upload claimed: an SVG
 * or an HTML file named `.png` would be a script served from this origin.
 *
 * Where they are kept is the deployment's: this process's memory for one server, Redis for several — a picture
 * uploaded through one replica is asked for from whichever one the next page load reaches.
 */

type Kind = { mime: string; matches: (bytes: Buffer) => boolean };

const KINDS: readonly Kind[] = [
  {
    mime: 'image/png',
    matches: bytes => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  { mime: 'image/jpeg', matches: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  { mime: 'image/gif', matches: bytes => bytes.subarray(0, 4).toString('latin1') === 'GIF8' },
  {
    mime: 'image/webp',
    matches: bytes =>
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  }
];

/** One picture: the browser downscales before it sends, so this is a ceiling for the odd one that could not. */
export const MAX_ASSET_BYTES = 700 * 1024;

/** Per board: enough for a moodboard, not a photo library in a demo's memory. */
const MAX_BOARD_ASSETS = 40;

const MAX_BOARD_BYTES = 16 * 1024 * 1024;

export type Asset = { mime: string; bytes: Buffer };

/** Where a deployment keeps the pictures. `add` answers `false` when the board already holds its share. */
export type AssetStore = {
  add: (board: string, id: string, asset: Asset) => Promise<boolean>;
  read: (board: string, id: string) => Promise<Asset | undefined>;
  /** A board copied brings its pictures: the same bytes, under the same ids, kept beside the copy. */
  copy: (from: string, to: string, ids: readonly string[]) => Promise<void>;
  forget: (board: string) => Promise<void>;
};

const DATA_URL = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Keeps a picture sent as a data URL, and answers its id. Refused — with what to do about it — when it is not an
 * image, is too big, or the board already holds its share.
 */
export const keepAsset = async (store: AssetStore, board: string, data: unknown): Promise<string> => {
  const match = typeof data === 'string' ? DATA_URL.exec(data) : null;
  if (!match) {
    throw new Error('A picture arrives as a data URL: `data:image/png;base64,…`');
  }

  const bytes = Buffer.from(match[2], 'base64');
  const kind = KINDS.find(candidate => candidate.matches(bytes));
  if (!kind) {
    throw new Error('Only PNG, JPEG, GIF and WebP pictures can be put on a board');
  }

  if (bytes.length > MAX_ASSET_BYTES) {
    throw new Error(`A picture is at most ${Math.round(MAX_ASSET_BYTES / 1024)} KB — try a smaller one`);
  }

  const id = randomBytes(16).toString('base64url');
  if (!(await store.add(board, id, { mime: kind.mime, bytes }))) {
    throw new Error('This board holds as many pictures as it can');
  }

  return id;
};

const fits = (count: number, total: number, adding: number): boolean =>
  count < MAX_BOARD_ASSETS && total + adding <= MAX_BOARD_BYTES;

/** One process's pictures, in its memory: right for one server, and gone with it. */
export const createMemoryAssets = (): AssetStore => {
  const boards = new Map<string, Map<string, Asset>>();

  return {
    add: (board, id, asset) => {
      const assets = boards.get(board) ?? new Map<string, Asset>();
      const total = [...assets.values()].reduce((sum, kept) => sum + kept.bytes.length, 0);
      if (!fits(assets.size, total, asset.bytes.length)) {
        return Promise.resolve(false);
      }

      assets.set(id, asset);
      boards.set(board, assets);

      return Promise.resolve(true);
    },
    read: (board, id) => Promise.resolve(boards.get(board)?.get(id)),
    copy: (from, to, ids) => {
      const source = boards.get(from);
      if (source) {
        const target = boards.get(to) ?? new Map<string, Asset>();
        for (const id of ids) {
          const asset = source.get(id);
          if (asset) {
            target.set(id, asset);
          }
        }

        boards.set(to, target);
      }

      return Promise.resolve();
    },
    forget: board => {
      boards.delete(board);

      return Promise.resolve();
    }
  };
};

/**
 * Pictures in Redis, for replicas that share it: per board, one hash of the bytes — each value its type, a newline,
 * and the picture — and one of their sizes, so the board's share is counted without reading every picture back.
 *
 * The share is checked, then written: two uploads to one board through two replicas in the same instant can both
 * pass it. A picture over a soft ceiling is what that costs, which is not worth a lock.
 */
export const createRedisAssets = (redis: Redis, prefix = 'pizarra:'): AssetStore => {
  const bytesKey = (board: string): string => `${prefix}assets:${board}`;
  const sizesKey = (board: string): string => `${prefix}asset-sizes:${board}`;

  const read = async (board: string, id: string): Promise<Asset | undefined> => {
    const stored = await redis.hgetBuffer(bytesKey(board), id);
    const newline = stored ? stored.indexOf(0x0a) : -1;

    return stored && newline > 0
      ? { mime: stored.subarray(0, newline).toString('latin1'), bytes: stored.subarray(newline + 1) }
      : undefined;
  };

  const write = async (board: string, id: string, { mime, bytes }: Asset): Promise<void> => {
    await redis
      .multi()
      .hset(bytesKey(board), id, Buffer.concat([Buffer.from(`${mime}\n`, 'latin1'), bytes]))
      .hset(sizesKey(board), id, bytes.length)
      .exec();
  };

  return {
    add: async (board, id, asset) => {
      const sizes = (await redis.hvals(sizesKey(board))).map(Number);
      if (
        !fits(
          sizes.length,
          sizes.reduce((sum, size) => sum + size, 0),
          asset.bytes.length
        )
      ) {
        return false;
      }

      await write(board, id, asset);

      return true;
    },
    read,
    copy: async (from, to, ids) => {
      for (const id of ids) {
        const asset = await read(from, id);
        if (asset) {
          await write(to, id, asset);
        }
      }
    },
    forget: async board => {
      await redis.del(bytesKey(board), sizesKey(board));
    }
  };
};
