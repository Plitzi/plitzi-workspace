import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { iconGlyphsAt } from './glyphs';
import { ICONS_PATH, spaceIconsOf } from './spaceIcons';
import { offlineDataCacheKeyOf } from '../../helpers/cache';

import type { SpaceIconFace } from './spaceIcons';
import type { TtlCache } from '../../helpers/cache';
import type { SSRPageServerConfig } from '../../types';
import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-kernel/types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

const FACE_PATH = new RegExp(`^${ICONS_PATH.replace(/\//g, '\\/')}([\\w-]{16})-(solid|regular|brands)\\.woff2$`);

/** The faces cut, by hash and face: a few kilobytes each, the same for every replica that cuts them. */
const CUT_KEEP = 128;
const cut = new Map<string, Promise<Buffer>>();

const cutFace = (sdkDir: string, face: SpaceIconFace, key: string): Promise<Buffer> => {
  const known = cut.get(key);
  if (known) {
    return known;
  }

  const made = (async () => {
    // Loaded on the first face asked for: a page server that never serves one never holds the subsetter.
    const { default: subsetFont } = await import('subset-font');
    const whole = await readFile(path.join(sdkDir, 'webfonts', face.file));

    return subsetFont(whole, String.fromCodePoint(...face.codepoints), { targetFormat: 'woff2' });
  })();
  cut.set(key, made);
  made.catch(() => cut.delete(key));
  if (cut.size > CUT_KEEP) {
    const oldest = cut.keys().next().value;
    if (oldest !== undefined) {
      cut.delete(oldest);
    }
  }

  return made;
};

const notFound = (res: SSRResponseHelpers, message: string): void => {
  res.setStatus(404);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(message);
};

/**
 * A face of the icon font cut to the glyphs the space names (`spaceIconsOf`), linked by its pages' heads — answered by
 * whichever replica the request reaches, from the space as the request resolves it, as the stylesheet is. The name is
 * the glyphs': asked for by the name it has now, it is kept for good; by an older one, it answers the space's glyphs as
 * they are, kept by nobody — a glyph either lacks is drawn from the whole font all the same.
 */
export const handleIconFace = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRPageServerConfig,
  sdkDir: string | undefined,
  offlineDataCache?: TtlCache<OfflineDataRaw>
): Promise<void> => {
  const asked = FACE_PATH.exec(req.path);
  if (!asked || !sdkDir) {
    notFound(res, sdkDir ? 'No such icon face' : 'This server has no SDK installed to cut icon faces from');

    return;
  }

  const [, hash, key] = asked;
  const { environment = 'main', revision = 0 } = req.ctx.spaceDeployment ?? {};
  const spaceId = req.ctx.spaceDeployment?.spaceId ?? 1;
  const cacheKey = offlineDataCacheKeyOf(req.ctx.spaceDeployment);
  const offlineData =
    (cacheKey ? offlineDataCache?.get(cacheKey) : undefined) ??
    (await config.adapters.getOfflineData(spaceId, environment, revision));
  const icons = offlineData ? spaceIconsOf(offlineData, iconGlyphsAt(sdkDir)) : undefined;
  const face = icons?.faces.find(candidate => candidate.key === key);
  if (!icons || !face) {
    notFound(res, `Space ${String(spaceId)} (${environment}) names no ${key} icon`);

    return;
  }

  const font = await cutFace(sdkDir, face, `${icons.hash}-${key}`);
  res.setHeader('Content-Type', 'font/woff2');
  res.setHeader('Cache-Control', icons.hash === hash ? 'public, max-age=31536000, immutable' : 'no-store');
  res.send(font);
};
