type TokenMapValue = string | number | boolean;

interface TokenMap {
  [key: string]: TokenMapValue | TokenMap; // primitive or nested values
}

const processCssTokens = <T extends TokenMap>(
  cache: string = '',
  variables: T = {} as T,
  opts: { missing?: string } = { missing: '' }
) => {
  const missing = opts.missing ?? '';

  return cache.replace(/\{\{\s*([a-z0-9_\-.$]+)\s*\}\}/gi, (_, key: string) => {
    const parts = key.split('.');
    let cur: unknown = variables;

    for (const p of parts) {
      if (typeof cur !== 'object' || cur === null) {
        return missing;
      }

      const obj = cur as Record<string, unknown>;
      if (!(p in obj)) {
        return missing;
      }

      cur = obj[p];
    }

    // Solo permitir tipos de valor seguros
    if (typeof cur === 'string' || typeof cur === 'number' || typeof cur === 'boolean') {
      return String(cur);
    }

    return missing;
  });
};

export default processCssTokens;
