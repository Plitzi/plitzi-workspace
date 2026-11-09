export type Path = string | readonly (string | number)[];

function validateSegment(segment: unknown): string | null {
  if (typeof segment === 'string' || typeof segment === 'number') {
    const s = String(segment);
    if (s === '') {
      return null;
    }

    if (/^[a-zA-Z0-9_-]+$/.test(s) || /^\d+$/.test(s)) {
      return s;
    }

    return null;
  }

  return null;
}

function parseStringPath(path: string, strict: boolean): string[] {
  if (!path) {
    return [];
  }

  if (path.startsWith('.') || path.endsWith('.') || /[^a-zA-Z0-9_.[\]-]/.test(path)) {
    return [];
  }

  if (strict) {
    // Double dots or empty brackets
    if (/\.\.|(\[\])/g.test(path)) {
      return [];
    }

    // Bracket parity check
    const open = (path.match(/\[/g) || []).length;
    const close = (path.match(/\]/g) || []).length;
    if (open !== close) {
      return [];
    }

    // No characters immediately after ] except . or [
    if (/\][^.[]/.test(path)) {
      return [];
    }
  }

  const result: string[] = [];
  const regex = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path))) {
    if (match[1]) {
      if (!strict && match[1] === '') {
        continue;
      }
      const seg = validateSegment(match[1]);
      if (seg !== null) {
        result.push(seg);
      } else if (strict) {
        return [];
      }
    } else if (match[2]) {
      const seg = validateSegment(match[2]);
      if (seg !== null) {
        result.push(seg);
      } else if (strict) {
        return [];
      }
    }
  }

  return result.length ? result : [];
}

function parseArrayPath(path: readonly (string | number)[], strict: boolean): string[] {
  if (!Array.isArray(path)) {
    return [];
  }

  const result: string[] = [];
  for (const seg of path) {
    const valid = validateSegment(seg);
    if (valid !== null) {
      result.push(valid);
    } else if (strict) {
      return [];
    }
  }
  return result;
}

export function toPath(path: Path, strict = true): string[] {
  if (!path) {
    return [];
  }

  if (typeof path === 'string') {
    return parseStringPath(path, strict);
  }

  if (Array.isArray(path)) {
    return parseArrayPath(path, strict);
  }

  return [];
}
