import type { BoardElement } from '../../board/model.ts';

/**
 * The pictures on a board: read from what was pasted or dropped, shown at once from the page's own copy while they
 * upload, and loaded from the server for everybody else.
 */

/** The longest side a picture is kept at: sharp on a board, small enough to upload and to share. */
const LONGEST_SIDE = 1600;

/** Under the server's ceiling, with room for the data URL's own weight (base64 is a third larger). */
const MAX_DATA_URL = 900_000;

export type ReadPicture = { data: string; width: number; height: number; image: HTMLImageElement };

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That picture could not be read'));
    image.src = src;
  });

/**
 * A pasted or dropped picture, made fit to keep: scaled down to a sensible size and re-encoded — WebP where the
 * browser writes it, JPEG otherwise, a smaller JPEG if it is still too heavy. What travels is what is drawn: the page
 * shows the same pixels it sent.
 */
export const readPicture = async (file: Blob): Promise<ReadPicture> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
  const encode = (factor: number, type: string, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale * factor));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale * factor));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL(type, quality);
  };

  const attempts: [number, string, number][] = [
    [1, 'image/webp', 0.86],
    [1, 'image/jpeg', 0.82],
    [0.7, 'image/jpeg', 0.78],
    [0.5, 'image/jpeg', 0.72]
  ];
  let data = '';
  for (const [factor, type, quality] of attempts) {
    data = encode(factor, type, quality);
    // A browser that cannot write WebP answers PNG, which is heavier: the JPEG attempts that follow cover it.
    if (data.length <= MAX_DATA_URL && !data.startsWith('data:image/png')) {
      break;
    }
  }

  // Measured before it is let go: a closed bitmap reports a size of nothing.
  const [width, height] = [bitmap.width * scale, bitmap.height * scale];
  bitmap.close();

  return { data, width, height, image: await loadImage(data) };
};

/** The first picture among what was pasted or dropped. */
export const pictureIn = (entries: ArrayLike<File | DataTransferItem>): File | undefined => {
  for (const entry of Array.from(entries)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null;
    if (file?.type.startsWith('image/')) {
      return file;
    }
  }

  return undefined;
};

export type Pictures = ReturnType<typeof createPictures>;

/** Every picture this page draws: by asset once the server has it, by element while it is still on its way. */
export const createPictures = (onLoad: () => void) => {
  const loaded = new Map<string, HTMLImageElement | 'loading' | 'failed'>();
  const pending = new Map<string, HTMLImageElement>();

  return {
    /** What to draw for an image element, loading it the first time it is asked for. */
    of: (element: BoardElement, base: string): HTMLImageElement | undefined => {
      const own = pending.get(element.id);
      if (own) {
        return own;
      }

      if (!element.asset || !base) {
        return undefined;
      }

      const known = loaded.get(element.asset);
      if (known instanceof HTMLImageElement) {
        return known;
      }

      if (known === undefined) {
        const asset = element.asset;
        loaded.set(asset, 'loading');
        loadImage(`${base}/${asset}`)
          .then(image => {
            loaded.set(asset, image);
            onLoad();
          })
          .catch(() => loaded.set(asset, 'failed'));
      }

      return undefined;
    },

    /** A picture shown before it is uploaded, from this page's own copy. */
    hold: (elementId: string, image: HTMLImageElement): void => {
      pending.set(elementId, image);
    },

    /** Uploaded: the page's copy becomes the asset's, so the picture never flickers into a download. */
    place: (elementId: string, asset: string): void => {
      const image = pending.get(elementId);
      if (image) {
        loaded.set(asset, image);
      }

      pending.delete(elementId);
    },

    drop: (elementId: string): void => {
      pending.delete(elementId);
    }
  };
};
