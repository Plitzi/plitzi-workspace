import { createGoogleFontsMirror, GOOGLE_FONTS_PATH } from '../../../modules/fonts/googleFonts';

import type { Stage } from '../types';
import type { SSRFontsConfig, SSRServerConfig } from '@plitzi/sdk-shared';

/** Where this server's pages ask for their Google families — its own mirror, unless `fonts.google` is `false`. */
export const googleFontsUrlOf = (config: Pick<SSRServerConfig, 'fonts'>): string | undefined =>
  config.fonts?.google === false ? undefined : GOOGLE_FONTS_PATH;

/** One mirror per configuration, made on the first request: its cache is the process's, whatever asks. */
const mirrors = new WeakMap<object, ReturnType<typeof createGoogleFontsMirror>>();
const DEFAULT_CONFIG = {};

const mirrorFor = (google: Exclude<SSRFontsConfig['google'], false>) => {
  const key = google ?? DEFAULT_CONFIG;
  const known = mirrors.get(key);
  if (known) {
    return known;
  }

  const made = createGoogleFontsMirror(google?.maxBytes === undefined ? {} : { maxBytes: google.maxBytes });
  mirrors.set(key, made);

  return made;
};

/** `/_plitzi/fonts/google/css2?family=…` and the files it names — see `SSRFontsConfig.google`. */
export const googleFontsStage: Stage = async ctx => {
  const google = ctx.config.fonts?.google;
  if (google === false || !ctx.req.path.startsWith(`${GOOGLE_FONTS_PATH}/`)) {
    return false;
  }

  if (ctx.req.method !== 'GET' && ctx.req.method !== 'HEAD') {
    ctx.res.setStatus(405);
    ctx.res.setHeader('Allow', 'GET, HEAD');
    ctx.res.send('Method not allowed');

    return true;
  }

  const answer = await mirrorFor(google)({ path: ctx.req.path, query: ctx.req.query, search: ctx.req.search });
  ctx.res.setStatus(answer.status);
  for (const [name, value] of Object.entries(answer.headers)) {
    ctx.res.setHeader(name, value);
  }

  ctx.res.send(answer.body);

  return true;
};
