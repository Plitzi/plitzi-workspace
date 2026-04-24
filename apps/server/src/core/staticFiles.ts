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

  const content = fs.readFileSync(filePath);
  res.setHeader('Content-Type', getMimeType(filePath));
  res.setHeader('Content-Length', content.byteLength.toString());
  res.send(content.toString('utf-8'));
  return true;
};

export const serveStatic = (req: SSRRequest, res: SSRResponseHelpers, rootDir: string): boolean => {
  const relative = req.path.replace(/^\/+/, '');
  const filePath = path.resolve(rootDir, relative);
  if (!filePath.startsWith(path.resolve(rootDir))) {
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
