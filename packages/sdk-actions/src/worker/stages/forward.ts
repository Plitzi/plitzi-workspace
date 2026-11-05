import { request } from 'node:http';

import type { DeployedContext } from '@plitzi/sdk-kernel/deployment';
import type { Stage } from '@plitzi/sdk-kernel/http';

/** Said on a request one worker hands another: the second serves it, and never hands it on again. */
export const FORWARDED_HEADER = 'x-plitzi-forwarded';

/**
 * Hands a space's request to the worker that serves it, when the deployment keeps some spaces on workers of their own:
 * `forward` answers that worker's origin for the space, or nothing when this one serves it. The request goes as it
 * came — its method, its headers (its host among them, so the other resolves the same space), its body streamed — and
 * the answer comes back the same way, an event stream included. Once only: the other worker serves what it is handed.
 * One it cannot reach is answered 502, saying which, never served here in its place unsaid.
 */
export const createForwardStage =
  (forward: (spaceId: number) => string | undefined): Stage<DeployedContext> =>
  ({ raw, rawRes, req }) => {
    const spaceId = req.ctx.spaceDeployment?.spaceId;
    if (spaceId == null || raw.headers[FORWARDED_HEADER] !== undefined) {
      return false;
    }

    const target = forward(spaceId);
    if (!target) {
      return false;
    }

    return new Promise<boolean>(resolve => {
      const upstream = request(
        new URL(raw.url ?? '/', target),
        { method: raw.method, headers: { ...raw.headers, [FORWARDED_HEADER]: '1' } },
        answer => {
          const headers = Object.fromEntries(
            Object.entries(answer.headers).flatMap(([name, value]) => (value === undefined ? [] : [[name, value]]))
          );
          rawRes.writeHead(answer.statusCode ?? 502, headers);
          answer.on('data', (chunk: Buffer) => {
            rawRes.write(chunk);
          });
          answer.on('end', () => {
            rawRes.end();
            resolve(true);
          });
          answer.on('error', () => {
            rawRes.end();
            resolve(true);
          });
        }
      );
      upstream.on('error', error => {
        if (!rawRes.headersSent) {
          rawRes.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
          rawRes.write(
            JSON.stringify({
              error: `The worker that serves space ${String(spaceId)} did not answer: ${error.message}`
            })
          );
        }

        rawRes.end();
        resolve(true);
      });
      raw.pipe(upstream);
    });
  };
