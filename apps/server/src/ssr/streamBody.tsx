import { Writable } from 'node:stream';

import { renderToPipeableStream } from 'react-dom/server';

import Component from './Component';
import { prepareRender } from './prepareRender';

import type { TtlCache } from '../helpers/cache';
import type { RequestMetrics } from '../helpers/metrics';
import type { PluginManager } from '../plugins/manager';
import type { Environment, SSRRequest, SSRResponseHelpers, SSRServerConfig, SSRTemplateFn } from '@plitzi/sdk-shared';

// Placeholder injected into the template so we can split head/tail without parsing HTML.
const SSR_SENTINEL = '<!--SSR_CONTENT-->';

export const streamBody = async (
  req: SSRRequest,
  res: SSRResponseHelpers,
  config: SSRServerConfig,
  spaceId: number,
  environment: Environment,
  revision: number,
  renderFn: SSRTemplateFn,
  pluginManager: PluginManager,
  offlineDataCache?: TtlCache<string>,
  htmlCache?: TtlCache<string>,
  cacheKey?: string,
  metrics?: RequestMetrics
): Promise<void> => {
  const prep = await prepareRender(
    req,
    config,
    spaceId,
    environment,
    revision,
    pluginManager,
    offlineDataCache,
    metrics
  );

  // Render the template with a sentinel in place of React HTML, then split it.
  // This lets us flush <head> + scripts to the browser before React renders.
  let t = metrics ? performance.now() : 0;
  const fullTemplate = renderFn({ ...prep.templateParams, html: SSR_SENTINEL });
  metrics?.record('template', Math.round(performance.now() - t));

  const sentinelIdx = fullTemplate.indexOf(SSR_SENTINEL);
  const head = sentinelIdx >= 0 ? fullTemplate.slice(0, sentinelIdx) : fullTemplate;
  const tail = sentinelIdx >= 0 ? fullTemplate.slice(sentinelIdx + SSR_SENTINEL.length) : '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  await new Promise<void>((resolve, reject) => {
    const chunks: Buffer[] = [];

    const writable = new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunks.push(chunk);
        res.write(chunk);
        cb();
      },
      final(cb) {
        const tailBuf = Buffer.from(tail, 'utf-8');
        res.write(tailBuf);
        res.end();

        if (cacheKey && htmlCache) {
          htmlCache.set(cacheKey, head + Buffer.concat(chunks).toString('utf-8') + tail);
        }

        resolve();
        cb();
      }
    });

    t = metrics ? performance.now() : 0;
    const { pipe } = renderToPipeableStream(<Component {...prep.componentProps} />, {
      onShellReady() {
        metrics?.record('react', Math.round(performance.now() - t));

        // Flush headers + head HTML — browser starts loading scripts from here.
        if (metrics) {
          res.setHeader('Server-Timing', metrics.toServerTimingHeader());
          metrics.log(`${req.method} ${req.path}`);
        }

        res.write(Buffer.from(head, 'utf-8'));
        pipe(writable);
      },
      onError(err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
};
