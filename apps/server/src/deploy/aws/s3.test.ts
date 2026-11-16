import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { s3Uploader } from './s3';

import type { SiteFile } from '../types';
import type { IncomingMessage, Server } from 'node:http';

/** A bucket and a CloudFront that answer as AWS's do, on this machine: what the uploader asks, in order. */

type Seen = { method: string; path: string; headers: IncomingMessage['headers']; body: string };

let server: Server | undefined;

afterEach(async () => {
  await new Promise(resolve => server?.close(resolve));
  server = undefined;
});

const CONFIG = `<?xml version="1.0"?><DistributionConfig><Origins><Quantity>1</Quantity><Items><Origin><Id>site</Id><DomainName>acme-site.s3.us-east-1.amazonaws.com</DomainName><OriginPath>/deploys/old</OriginPath></Origin></Items></Origins></DistributionConfig>`;

const listen = async (answer: (seen: Seen) => { status: number; body?: string; headers?: Record<string, string> }) => {
  const seen: Seen[] = [];
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const request = {
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString()
      };
      seen.push(request);
      const { status, body = '', headers = {} } = answer(request);
      res.writeHead(status, headers).end(body);
    });
  });
  await new Promise<void>(resolve => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  return { seen, endpoint: `http://127.0.0.1:${String(typeof address === 'object' && address ? address.port : 0)}` };
};

const file = (path: string, cache: SiteFile['cache']): SiteFile => ({
  path,
  body: new TextEncoder().encode(path),
  type: 'text/html',
  cache
});
const credentials = { accessKeyId: 'AKID', secretAccessKey: 'secret' };

describe('a site written to a bucket', () => {
  it('writes every file, signed, and keeps an immutable one the bucket already holds', async () => {
    const { seen, endpoint } = await listen(({ method, path }) => ({
      status: method === 'HEAD' && path.endsWith('sdk.js') ? 200 : method === 'HEAD' ? 404 : 200
    }));
    const log: string[] = [];
    const result = await s3Uploader(
      { bucket: 'acme', region: 'auto', credentials, endpoint, prefix: 'site' },
      { reference: 'd1' }
    ).upload(
      [
        file('index.html', 'revalidate'),
        file('_plitzi/sdk-1/sdk.js', 'immutable'),
        file('_plitzi/sdk-1/new.js', 'immutable')
      ],
      line => log.push(line)
    );

    const puts = seen.filter(({ method }) => method === 'PUT');
    expect(puts.map(({ path }) => path).sort()).toEqual(['/acme/site/_plitzi/sdk-1/new.js', '/acme/site/index.html']);
    expect(puts[0].headers.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\/\d{8}\/auto\/s3\/aws4_request/);
    expect(puts.find(({ path }) => path.endsWith('index.html'))?.headers['cache-control']).toBe(
      'public, max-age=0, must-revalidate'
    );
    expect(result).toMatchObject({ files: 3, reference: 'site' });
    expect(log.join('\n')).toMatch(/replaced one by one/);
    expect(log.join('\n')).toMatch(/1 were there already/);
  });

  it('says what the storage answered when it refuses', async () => {
    const { endpoint } = await listen(({ method }) => ({
      status: method === 'HEAD' ? 404 : 403,
      body: '<Error><Code>AccessDenied</Code><Message>Access Denied for acme</Message></Error>'
    }));

    await expect(
      s3Uploader({ bucket: 'acme', region: 'auto', credentials, endpoint }, { reference: 'd1' }).upload(
        [file('index.html', 'revalidate')],
        () => undefined
      )
    ).rejects.toThrow('Writing index.html to the bucket acme was refused (403): Access Denied for acme');
  });

  it('behind CloudFront, writes the deploy under a prefix of its own, then points the distribution at it in one step', async () => {
    const { seen, endpoint } = await listen(({ method, path }) =>
      path.endsWith('/config') && method === 'GET'
        ? { status: 200, body: CONFIG, headers: { etag: 'E1' } }
        : { status: method === 'HEAD' ? 404 : 200 }
    );
    const log: string[] = [];
    const result = await s3Uploader(
      { bucket: 'acme-site', region: 'us-east-1', credentials, endpoint },
      { reference: 'd42', cloudFront: { distributionId: 'DIST', credentials, endpoint } }
    ).upload([file('index.html', 'revalidate')], line => log.push(line));

    const update = seen.find(({ method, path }) => method === 'PUT' && path.endsWith('/config'));
    expect(seen.find(({ method }) => method === 'PUT')?.path).toBe('/acme-site/deploys/d42/index.html');
    expect(update?.headers['if-match']).toBe('E1');
    expect(update?.body).toContain('<OriginPath>/deploys/d42</OriginPath>');
    expect(update?.body).not.toContain('/deploys/old');
    expect(seen.at(-1)?.path).toBe('/distribution/DIST/invalidation');
    expect(result.reference).toBe('/deploys/d42');
    expect(log.join('\n')).toContain('it served /deploys/old');
  });
});
