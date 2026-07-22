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
    if (!isSimpleIdentifier(trimmed)) {
      return null;
    }

    const value = resolveSimplePath(context, trimmed);
    parts.push(serializeValue(value));

    pos = varEnd + 2;
  }

  return parts.join('');
};
