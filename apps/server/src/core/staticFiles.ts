import fs from 'node:fs';
import path from 'node:path';

import type { SSRRequest, SSRResponseHelpers } from '../types';

// Basic MIME-type lookup by file extension.
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml'
};

const getMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
};

/**
 * Attempt to serve a static file from the given `rootDir`.
 * The URL prefix (`urlPrefix`) has already been stripped from `req.path` by
 * the caller before this is invoked.
 *
 * Returns `true` if the file was found and served; `false` otherwise.
 */
export const serveStatic = (req: SSRRequest, res: SSRResponseHelpers, rootDir: string): boolean => {
  // Security: prevent directory traversal
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
    // Try index.html inside the directory
    const indexPath = path.join(filePath, 'index.html');
    if (!fs.existsSync(indexPath)) return false;
    const content = fs.readFileSync(indexPath);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', content.byteLength.toString());
    res.send(content.toString('utf-8'));
    return true;
  }

  const content = fs.readFileSync(filePath);
  res.setHeader('Content-Type', getMimeType(filePath));
  res.setHeader('Content-Length', content.byteLength.toString());
  res.send(content.toString('utf-8'));
  return true;
};
