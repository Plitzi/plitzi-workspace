import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

export type ContentEncoding = 'br' | 'gzip' | 'identity';

const MIN_SIZE = 1024;

export const selectEncoding = (acceptEncoding: string | undefined): ContentEncoding => {
  if (!acceptEncoding) {
    return 'identity';
  }
  if (acceptEncoding.includes('br')) {
    return 'br';
  }
  if (acceptEncoding.includes('gzip')) {
    return 'gzip';
  }
  return 'identity';
};

export const compressBody = (body: string, encoding: ContentEncoding): Buffer | string => {
  if (encoding === 'identity' || body.length < MIN_SIZE) {
    return body;
  }
  const buf = Buffer.from(body, 'utf-8');
  if (encoding === 'br') {
    return brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
  }
  return gzipSync(buf, { level: 6 });
};
