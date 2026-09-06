import fs from 'node:fs';
import path from 'node:path';

import { getMimeType, getCacheControl } from './mimeTypes';

import type { SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

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

  // The Buffer as read, not a string: a woff2 or a png has bytes that are not valid UTF-8, and decoding then
  // re-encoding them replaces every one of those with U+FFFD — a file that arrives the right length and broken.
  const content = fs.readFileSync(filePath);
  res.setHeader('Content-Type', getMimeType(filePath));
  res.send(content);
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
