export const isSimpleIdentifier = (s: string): boolean => {
  const len = s.length;
  if (len === 0) {
    return false;
  }
  const ch = s.charCodeAt(0);
  if (!((ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || ch === 95)) {
    return false;
  }
  for (let i = 1; i < len; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95) {
      continue;
    }
    return false;
  }
  return true;
};

export const resolveSimplePath = (context: Record<string, unknown>, name: string): unknown => context[name];

export const resolveDottedPath = (context: Record<string, unknown>, path: string): unknown => {
  const firstEnd = path.indexOf('.');
  if (firstEnd === -1) {
    return context[path];
  }

  let current: unknown = context[path.slice(0, firstEnd)];
  let start = firstEnd + 1;
  const len = path.length;

  while (start < len) {
    if (current === null || current === undefined) {
      return undefined;
    }
    const nextDot = path.indexOf('.', start);
    if (nextDot === -1) {
      return (current as Record<string, unknown>)[path.slice(start)];
    }
    current = (current as Record<string, unknown>)[path.slice(start, nextDot)];
    start = nextDot + 1;
  }
  return current;
};

export const isDottedPath = (s: string): boolean => {
  const len = s.length;
  if (len === 0) {
    return false;
  }
  let i = 0;
  while (i < len) {
    const c = s.charCodeAt(i);
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95) {
      i++;
      while (i < len) {
        const ch = s.charCodeAt(i);
        if ((ch >= 97 && ch <= 122) || (ch >= 65 && ch <= 90) || (ch >= 48 && ch <= 57) || ch === 95) {
          i++;
          continue;
        }
        break;
      }
    } else {
      return false;
    }
    if (i < len) {
      if (s.charCodeAt(i) !== 46) {
        return false;
      }
      i++;
      if (i >= len) {
        return false;
      }
    }
  }
  return true;
};

export const serializeValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

export const trySimpleFastPath = (template: string, context: Record<string, unknown>): string | null => {
  if (template.indexOf('{%') !== -1) {
    return null;
  }

  if (template.indexOf('{{') === -1) {
    return template;
  }

  if (template.indexOf('{{{') !== -1) {
    return null;
  }

  const parts: string[] = [];
  let pos = 0;

  while (pos < template.length) {
    const varStart = template.indexOf('{{', pos);
    if (varStart === -1) {
      parts.push(template.slice(pos));
      break;
    }

    if (varStart > pos) {
      parts.push(template.slice(pos, varStart));
    }

    const varEnd = template.indexOf('}}', varStart + 2);
    if (varEnd === -1) {
      return null;
    }

    const inner = template.slice(varStart + 2, varEnd);
    const trimmed = inner.trim();

    if (isSimpleIdentifier(trimmed)) {
      parts.push(serializeValue(resolveSimplePath(context, trimmed)));
    } else if (isDottedPath(trimmed)) {
      parts.push(serializeValue(resolveDottedPath(context, trimmed)));
    } else {
      return null;
    }

    pos = varEnd + 2;
  }

  return parts.join('');
};
