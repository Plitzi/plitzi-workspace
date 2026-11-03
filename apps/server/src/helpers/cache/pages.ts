import { brotliDecompressSync, gunzipSync } from 'node:zlib';

import { compressBody } from '../compress';

import type { ResolvedCompression } from '../compress';
import type { CompressedBodies, SharedPage } from '@plitzi/sdk-shared';

/**
 * A rendered page as a process keeps it: compressed once, in the encoding the server prefers, and the HTML itself only
 * when there is nothing to compress it to (compression off, a page under the threshold). A 1 MB page is kept as the
 * ~90 KB a browser is sent; the HTML is made from it again for the rare client that takes no encoding.
 */
export type CachedPage = { compressed: CompressedBodies; html?: string };

export const keepPage = (html: string, compression: ResolvedCompression): CachedPage => {
  const encoding = compression.encodings.at(0);
  if (!encoding) {
    return { html, compressed: {} };
  }

  const body = compressBody(html, encoding, compression, true);

  return typeof body === 'string' ? { html, compressed: {} } : { compressed: { [encoding]: body } };
};

export const pageHtml = (page: CachedPage): string => {
  if (page.html !== undefined) {
    return page.html;
  }

  if (page.compressed.br) {
    return brotliDecompressSync(page.compressed.br).toString('utf-8');
  }

  if (page.compressed.gzip) {
    return gunzipSync(page.compressed.gzip).toString('utf-8');
  }

  return '';
};

/** What a kept page costs, in bytes: its compressed bodies, and its HTML when it is kept as it is. */
export const sizeOfPage = (page: CachedPage): number =>
  (page.html?.length ?? 0) + (page.compressed.br?.length ?? 0) + (page.compressed.gzip?.length ?? 0);

export const toSharedPage = (page: CachedPage, renderedAt: number): SharedPage => {
  if (page.compressed.br) {
    return { encoding: 'br', body: page.compressed.br, renderedAt };
  }

  if (page.compressed.gzip) {
    return { encoding: 'gzip', body: page.compressed.gzip, renderedAt };
  }

  return { encoding: 'identity', body: Buffer.from(page.html ?? '', 'utf-8'), renderedAt };
};

export const fromSharedPage = ({ encoding, body }: SharedPage): CachedPage =>
  encoding === 'identity' ? { html: body.toString('utf-8'), compressed: {} } : { compressed: { [encoding]: body } };
