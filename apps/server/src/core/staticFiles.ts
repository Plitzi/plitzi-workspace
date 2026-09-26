import fs from 'node:fs';
import path from 'node:path';

import { getMimeType, getCacheControl } from './mimeTypes';
import { CompressedFileCache } from '../helpers/cache/CompressedFileCache';

import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

// The SDK bundle, its vendor and stylesheet compress to well under a megabyte each; this leaves room for a
// deployment's own assets without letting a directory of large text files hold the process's memory.
const COMPRESSED_FILES_BUDGET_BYTES = 16 * 1024 * 1024;

const compressedFiles = new CompressedFileCache(COMPRESSED_FILES_BUDGET_BYTES);

// Text is what compresses; an image or a font is compressed already and goes out as the bytes on disk.
const isText = (mimeType: string): boolean => /^text\/|javascript|json|xml|svg/.test(mimeType);

const buildEtag = (stat: fs.Stats): string => `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;

const serveFile = (req: SSRRequest, res: SSRResponseHelpers, filePath: string, stat: fs.Stats): true => {
  const etag = buildEtag(stat);
  const ifNoneMatch = req.headers['if-none-match'];

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', getCacheControl(filePath));
  res.setHeader('Last-Modified', stat.mtime.toUTCString());

  if (ifNoneMatch === etag) {
    res.setStatus(304);
    res.end();
    return true;
  }

  const mimeType = getMimeType(filePath);
  res.setHeader('Content-Type', mimeType);
  if (isText(mimeType)) {
    // Read only when this request's encoding has no stored form yet — once per version of the file, not per request.
    res.send(() => fs.readFileSync(filePath, 'utf-8'), { compressed: compressedFiles.storeFor(filePath, etag) });
    compressedFiles.trim();

    return true;
  }

  // The Buffer as read, not a string: a woff2 or a png has bytes that are not valid UTF-8, and decoding then
  // re-encoding them replaces every one of those with U+FFFD — a file that arrives the right length and broken.
  res.send(fs.readFileSync(filePath));

  return true;
};

export const serveStatic = (req: SSRRequest, res: SSRResponseHelpers, rootDir: string): boolean => {
  const relative = req.path.replace(/^\/+/, '');
  const filePath = path.resolve(rootDir, relative);
  const resolvedRoot = path.resolve(rootDir);
  // Require separator after root so '/app/static' never matches '/app/staticEvil/secret'.
  if (filePath !== resolvedRoot && !filePath.startsWith(resolvedRoot + path.sep)) {
    res.setStatus(403);
    res.send('Forbidden');
    return true;
  }

  if (!fs.existsSync(filePath)) {
    return false;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return false;
    }
    return serveFile(req, res, indexPath, fs.statSync(indexPath));
  }

  return serveFile(req, res, filePath, stat);
};
