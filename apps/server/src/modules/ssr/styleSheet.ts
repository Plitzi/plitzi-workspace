import { STYLE_SHEET_PATH } from '@plitzi/sdk-shared/style';

import { offlineDataCacheKeyOf } from '../../helpers/cache';
import { styleSheetOf } from '../../helpers/hydrationPayload';

import type { TtlCache } from '../../helpers/cache';
import type { SSRPageServerConfig } from '../../types';
import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-kernel/types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

const SHEET_PATH = new RegExp(`^${STYLE_SHEET_PATH.replace(/\//g, '\\/')}([\\w-]{1,64})\\.css$`);

/**
 * The space's compiled stylesheet, linked by the page (`styleSheetOf`) — answered by whichever replica the request
 * reaches, from the space as the request resolves it: nothing of the page that linked it is needed, so a replica that
 * never drew that page answers it the same.
 *
 * The name is the text's: asked for by the name it has now, it is kept for good (`immutable`); by an older one — the
 * space changed since that page was drawn — it answers the stylesheet as it is, kept by nobody, and the page is
 * styled as the space now is rather than not at all. Public whoever asks: it is the same for every visitor, and the
 * page it styles is where who may see what is decided.
 */
export const handleStyleSheet = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRPageServerConfig,
  offlineDataCache?: TtlCache<OfflineDataRaw>
): Promise<void> => {
  const hash = SHEET_PATH.exec(req.path)?.[1];
  const { environment = 'main', revision = 0 } = req.ctx.spaceDeployment ?? {};
  const spaceId = req.ctx.spaceDeployment?.spaceId ?? 1;
  const cacheKey = offlineDataCacheKeyOf(req.ctx.spaceDeployment);
  const offlineData =
    hash === undefined
      ? undefined
      : ((cacheKey ? offlineDataCache?.get(cacheKey) : undefined) ??
        (await config.adapters.getOfflineData(spaceId, environment, revision)));
  const sheet = offlineData ? styleSheetOf(offlineData) : undefined;
  if (!sheet) {
    res.setStatus(404);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.send(
      `/* This request resolves to space ${String(spaceId)} (${environment}), which links no stylesheet: its pages carry their styles. */`
    );

    return;
  }

  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', sheet.hash === hash ? 'public, max-age=31536000, immutable' : 'no-store');
  // Compressed once and kept with the sheet: every page of the space links the same one.
  res.send(() => sheet.css, { compressed: sheet.compressed });
};
