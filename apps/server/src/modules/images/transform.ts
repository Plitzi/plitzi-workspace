/**
 * Resizing and re-encoding, by `sharp` when the deployment installed it. An optional peer, as `isolated-vm` is: a
 * native module this package does not impose on a server that resizes nothing.
 */

/** The output a picture is encoded in: what the browser said it takes, or the picture's own format. */
export type ImageFormat = 'avif' | 'webp' | 'original';

/** The part of a `sharp` pipeline this server uses. */
type SharpPipeline = {
  rotate: () => SharpPipeline;
  resize: (options: { width: number; withoutEnlargement: boolean }) => SharpPipeline;
  avif: (options: { quality: number }) => SharpPipeline;
  webp: (options: { quality: number }) => SharpPipeline;
  toBuffer: () => Promise<Buffer>;
};

type SharpFactory = (input: Buffer) => SharpPipeline;

/** Resizes `input` to `width` (never larger than it is) in `format`. */
export type ImageTransform = (input: Buffer, width: number, format: ImageFormat) => Promise<Buffer>;

const isSharpFactory = (value: unknown): value is SharpFactory => typeof value === 'function';

/** The transform `sharp` makes, or `undefined` when it is not installed. */
export const loadSharpTransform = async (): Promise<ImageTransform | undefined> => {
  // Named through a variable so neither the type checker nor the bundler goes looking for a module that may not exist.
  const name = 'sharp';
  let loaded: unknown;
  try {
    loaded = await import(/* @vite-ignore */ name);
  } catch {
    return undefined;
  }

  const factory: unknown =
    typeof loaded === 'object' && loaded !== null && 'default' in loaded ? loaded.default : loaded;
  if (!isSharpFactory(factory)) {
    return undefined;
  }

  return async (input, width, format) => {
    // `rotate()` with no angle applies the photo's EXIF orientation, which a resize would otherwise lose.
    const pipeline = factory(input).rotate().resize({ width, withoutEnlargement: true });
    if (format === 'avif') {
      return pipeline.avif({ quality: 55 }).toBuffer();
    }

    if (format === 'webp') {
      return pipeline.webp({ quality: 75 }).toBuffer();
    }

    return pipeline.toBuffer();
  };
};
