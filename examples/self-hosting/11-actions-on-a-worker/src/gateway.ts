import http from 'node:http';

import { WORKER_PATHS, addresses } from './addresses.ts';

/**
 * The one origin people see: a space's paths sent by prefix — the worker's to the worker, everything else to the page
 * server. What an ingress, nginx or a load balancer does in front of a real deployment; here, thirty lines of Node. The
 * browser never learns there are two servers, so its session cookie and the cross-site check work as they would on
 * one.
 */
const upstreamOf = (path: string): string =>
  WORKER_PATHS.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
    ? addresses.worker.url
    : addresses.pages.url;

const gateway = http.createServer((req, res) => {
  const upstream = new URL(upstreamOf(new URL(req.url ?? '/', 'http://gateway').pathname));
  const forwarded = http.request(
    { host: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers: req.headers },
    answer => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    }
  );
  forwarded.on('error', error => {
    console.error(
      `[gateway] ${upstream.origin} did not answer ${req.method ?? 'GET'} ${req.url ?? '/'}: ${error.message}`
    );
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    }

    res.end(`${upstream.origin} did not answer: is it running?`);
  });
  req.pipe(forwarded);
});

gateway.listen(addresses.public.port, addresses.host, () => {
  console.log(`[gateway] the pages on ${addresses.public.url}/ — ${WORKER_PATHS.join(', ')} sent to the worker`);
  process.send?.('listening');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => gateway.close(() => process.exit(0)));
}
