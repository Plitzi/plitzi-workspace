export const MIME_TYPES: Record<string, string> = {
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

export const IMMUTABLE_EXTS = new Set(['.js', '.mjs', '.cjs', '.css', '.woff', '.woff2', '.ttf', '.eot']);

export const getMimeType = (filePath: string): string => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
};

export const getCacheControl = (filePath: string): string => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return IMMUTABLE_EXTS.has(ext) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
};
