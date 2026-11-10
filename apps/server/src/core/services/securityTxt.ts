import { servedSpace } from './servedSpace';

import type { SSRContext } from '../http/pageContext';
import type { Stage } from '@plitzi/sdk-kernel/http';

export const SECURITY_TXT_PATH = '/.well-known/security.txt';

/**
 * `/.well-known/security.txt` (RFC 9116): the space's own words (`settings.securityTxt`), as plain text — where somebody
 * who found a flaw writes, and until when that holds. A space that says nothing answers 404: a contact the site never
 * gave would send a researcher's report nowhere. Never the space's page for that address, which a reader takes for the
 * file.
 */
export const securityTxtStage: Stage<SSRContext> = async ctx => {
  const { req } = ctx;
  if (req.method !== 'GET' || req.path !== SECURITY_TXT_PATH) {
    return false;
  }

  ctx.operation = 'security';
  const own = (await servedSpace(ctx, SECURITY_TXT_PATH))?.schema.settings.securityTxt?.trim();
  ctx.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (!own) {
    ctx.res.setStatus(404);
    ctx.res.send('This site publishes no security.txt.\n');

    return true;
  }

  ctx.res.setStatus(200);
  ctx.res.send(`${own}\n`);

  return true;
};
