import { createHash } from 'node:crypto';

const canonicalize = (data: unknown): string => {
  if (data === null || data === undefined) {
    return 'null';
  }
  if (typeof data === 'string') {
    return JSON.stringify(data);
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return String(data);
  }
  if (Array.isArray(data)) {
    return `[${data.map(canonicalize).join(',')}]`;
  }
  if (typeof data === 'bigint') {
    return data.toString();
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data).sort();
    return `{${keys.map(k => `${canonicalize(k)}:${canonicalize((data as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return 'null';
};

export const computeVersion = (data: unknown): string => {
  const hash = createHash('sha1').update(canonicalize(data)).digest('hex');
  return hash.slice(0, 12);
};
