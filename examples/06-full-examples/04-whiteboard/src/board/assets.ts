import { randomBytes } from 'node:crypto';

/**
 * The pictures pasted onto boards: kept in this process's memory, beside the boards they belong to, and served by the
 * example's own route (`main.ts`). A board forgotten takes its pictures with it.
 *
 * Only what a browser shows as an image gets in, decided by the bytes rather than by what the upload claimed: an SVG
 * or an HTML file named `.png` would be a script served from this origin.
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

type Asset = { mime: string; bytes: Buffer };

const boards = new Map<string, Map<string, Asset>>();

const DATA_URL = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/;

/**
 * Keeps a picture sent as a data URL, and answers its id. Refused — with what to do about it — when it is not an
 * image, is too big, or the board already holds its share.
 */
export const keepAsset = (board: string, data: unknown): string => {
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

  const assets = boards.get(board) ?? new Map<string, Asset>();
  const total = [...assets.values()].reduce((sum, asset) => sum + asset.bytes.length, 0);
  if (assets.size >= MAX_BOARD_ASSETS || total + bytes.length > MAX_BOARD_BYTES) {
    throw new Error('This board holds as many pictures as it can');
  }

  const id = randomBytes(16).toString('base64url');
  assets.set(id, { mime: kind.mime, bytes });
  boards.set(board, assets);

  return id;
};

export const readAsset = (board: string, id: string): Asset | undefined => boards.get(board)?.get(id);

export const forgetBoardAssets = (board: string): void => {
  boards.delete(board);
};
