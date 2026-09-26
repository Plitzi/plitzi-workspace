import { closeOnSignals, createServer } from '@plitzi/sdk-server';

import { sampleSpace } from '../spaces';
import { getRscData, plugins } from './sample';

import type { SSRPageAdapters } from '@plitzi/sdk-shared';

/**
 * The sample space served by two processes on one port — how a production server uses a machine with more than one
 * core. Every response says which process served it, so a spec can see the load spread, and every page must come out
 * the same whichever process rendered it.
 *
 * `?published` serves the space as published — cached, unlike `main` — and `/__invalidate` is the endpoint a
 * deployment puts behind its publish webhook: it lands on one process, and every process must forget the page.
 */
export const PORT = Number(process.env.PORT ?? 5207);

const space = sampleSpace();

const adapters: SSRPageAdapters = {
  getOfflineData: () => Promise.resolve(space),
  getSpaceDeployment: req =>
    Promise.resolve({
      spaceId: 1,
      environment: 'published' in req.query ? 'production' : 'main',
      revision: 0,
      pluginNames: Object.keys(plugins)
    }),
  getRscData
};

const server = createServer({
  port: PORT,
  workers: 2,
  adapters,
  plugins,
  health: { payload: { role: 'e2e-workers', ok: true } },
  middlewares: [
    async (req, res, next) => {
      res.setHeader('X-Served-By', String(process.pid));
      if (req.path === '/__invalidate') {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ dropped: server.cache?.invalidate({ spaceId: 1 }) ?? 0 }));

        return;
      }

      await next();
    }
  ]
});

server.listen(PORT, '127.0.0.1');
closeOnSignals(server);
