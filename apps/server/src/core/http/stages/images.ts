import path from 'node:path';

import { IMAGE_PATH } from '@plitzi/sdk-shared/helpers/images';

import { serverLog } from '../../../helpers/serverLog';
import { createImageProxy } from '../../../modules/images/imageProxy';
import { loadSharpTransform } from '../../../modules/images/transform';

import type { ImageAnswer, ImageRequest } from '../../../modules/images/imageProxy';
import type { Stage } from '../types';
import type { SSRImagesConfig, SSRServerConfig } from '@plitzi/sdk-shared';

/** Where pictures are resized, when this server resizes them: published to the SDK, which builds every `srcset` on it. */
export const imagesPathOf = (config: Pick<SSRServerConfig, 'images'>): string | undefined =>
  config.images && config.images.domains.length > 0 ? IMAGE_PATH : undefined;

/** One proxy per configuration, made on the first request: `sharp` is looked for once, and said once when missing. */
const proxies = new WeakMap<SSRImagesConfig, Promise<(request: ImageRequest) => Promise<ImageAnswer>>>();

const proxyFor = (images: SSRImagesConfig): Promise<(request: ImageRequest) => Promise<ImageAnswer>> => {
  const known = proxies.get(images);
  if (known) {
    return known;
  }

  const made = loadSharpTransform().then(transform => {
    if (!transform) {
      serverLog.warn(
        'IMAGES',
        'sharp is not installed: pictures are passed through and kept, not resized (npm i sharp).'
      );
    }

    return createImageProxy({
      domains: images.domains,
      cacheDir: path.resolve(images.cacheDir ?? 'tmp/images'),
      fetch: globalThis.fetch,
      transform
    });
  });
  proxies.set(images, made);

  return made;
};

/** `/_plitzi/img?url=…&w=…` — a remote picture at one of the widths the SDK asks for. See `SSRImagesConfig`. */
export const imagesStage: Stage = async ctx => {
  const { images } = ctx.config;
  if (!images || imagesPathOf(ctx.config) === undefined || ctx.req.path !== IMAGE_PATH) {
    return false;
  }

  if (ctx.req.method !== 'GET' && ctx.req.method !== 'HEAD') {
    ctx.res.setStatus(405);
    ctx.res.setHeader('Allow', 'GET, HEAD');
    ctx.res.send('Method not allowed');

    return true;
  }

  const serve = await proxyFor(images);
  const answer = await serve({ url: ctx.req.query.url, width: ctx.req.query.w, accept: ctx.req.headers.accept ?? '' });
  ctx.res.setStatus(answer.status);
  for (const [name, value] of Object.entries(answer.headers)) {
    ctx.res.setHeader(name, value);
  }

  ctx.res.send(answer.body);

  return true;
};
