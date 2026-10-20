import { base64ToUtf8, md5Hex, utf8ToBase64 } from './hashing';
import { toStr } from './values';

import type { TwigFilter } from './types';

export const miscFilters: Record<string, TwigFilter> = {
  // `| url_encode` — percent-encodes a string or converts an object to query-string format.
  url_encode: value => {
    if (typeof value === 'string') {
      return encodeURIComponent(value);
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return new URLSearchParams(
        Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toStr(v)]))
      ).toString();
    }

    return value;
  },
  // `| nl2br` — inserts HTML `<br>` before every newline.
  nl2br: value => (typeof value === 'string' ? value.replace(/\n/g, '<br>') : value),
  // `| striptags` — strips HTML/XML tags; optional `allowable` arg keeps specific tags.
  striptags: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }

    const allowable = args.length > 0 ? toStr(args[0]).trim() : '';
    if (allowable) {
      const tagNames = allowable
        .split(/(?:\s*>\s*<\s*|<\s*|>\s*)/)
        .filter(Boolean)
        .map(t => t.replace(/[/>]/g, '').trim());
      if (tagNames.length > 0) {
        const pattern = new RegExp(`<(?!/?(?:${tagNames.join('|')})\\b)[^>]+>`, 'gi');
        return value.replace(pattern, '').replace(/\s+/g, ' ').trim();
      }
    }

    return value
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },
  // `| abs` — returns the absolute value of a number.
  abs: value => (typeof value === 'number' ? Math.abs(value) : value),
  // `| round(precision, mode)` — rounds a number; default precision 0, mode 'common' (Math.round).
  round: (value, args) => {
    if (typeof value !== 'number') {
      return value;
    }

    const precision = Number(args[0]) || 0;
    const mode = args[1] != null ? toStr(args[1]) : 'common';
    const factor = 10 ** precision;

    if (mode === 'ceil') {
      return Math.ceil(value * factor) / factor;
    }

    if (mode === 'floor') {
      return Math.floor(value * factor) / factor;
    }

    return Math.round(value * factor) / factor;
  },
  // `| format(args...)` — sprintf: `%s`, `%d`, `%f`, `%%`, each with PHP's optional flags (`-` left-justify, `+` sign,
  // `0` or `'c` padding), width and precision — `'%02d'|format(5)` is `05`, `'%.1f'|format(2.25)` is `2.3`.
  format: (value, args) => {
    if (typeof value !== 'string') {
      return value;
    }

    let index = 0;
    return value.replace(
      /%((?:[-+ 0]|'.)*)(\d*)(?:\.(\d+))?([sdf%])/g,
      (match, flags: string, width, precision, kind) => {
        if (kind === '%') {
          return '%';
        }

        const replacement = args[index];
        index++;
        if (replacement === undefined) {
          return match;
        }

        const signed = flags.includes('+');
        let body: string;
        if (kind === 'd') {
          const number = Math.trunc(Number(replacement));
          body = `${signed && number >= 0 ? '+' : ''}${number}`;
        } else if (kind === 'f') {
          const number = Number(replacement);
          // A bare `%f` keeps the number's own digits (`3.5`, not PHP's `3.500000`); a precision asks for exactly that many.
          body = `${signed && number >= 0 ? '+' : ''}${precision === undefined ? String(number) : number.toFixed(Number(precision))}`;
        } else {
          body = toStr(replacement);
          body = precision === undefined ? body : body.slice(0, Number(precision));
        }

        const size = Number(width || 0);
        if (body.length >= size) {
          return body;
        }

        const custom = /'(.)/.exec(flags);
        const filler = custom ? custom[1] : flags.includes('0') ? '0' : ' ';
        if (flags.includes('-')) {
          return body.padEnd(size, filler === '0' ? ' ' : filler);
        }

        // Zero padding goes between the sign and the digits, as it does in PHP: `%+05d` of 3 is `+0003`.
        if (filler === '0' && kind !== 's' && /^[+-]/.test(body)) {
          return body[0] + body.slice(1).padStart(size - 1, '0');
        }

        return body.padStart(size, filler);
      }
    );
  }
};

export const whitespaceFilters: Record<string, TwigFilter> = {
  // `| spaceless` — removes extra whitespace between HTML tags.
  spaceless: value => (typeof value === 'string' ? value.replace(/>\s+</g, '><').trim() : value)
};

export const randomFilters: Record<string, TwigFilter> = {
  // `| random` — returns a random element from an array or a random character from a string.
  random: value => {
    if (Array.isArray(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return value.length > 0 ? value[Math.floor(Math.random() * value.length)] : undefined;
    }
    if (typeof value === 'string') {
      return value.length > 0 ? value[Math.floor(Math.random() * value.length)] : '';
    }
    if (typeof value === 'number') {
      return Math.floor(Math.random() * value);
    }
    return value;
  }
};

export const encodingFilters: Record<string, TwigFilter> = {
  // `| base64_encode` — encodes a string to base64 (UTF-8 safe).
  base64_encode: value => (typeof value === 'string' ? utf8ToBase64(value) : value),
  // `| base64_decode` — decodes a base64 string (UTF-8 safe).
  base64_decode: value => (typeof value === 'string' ? base64ToUtf8(value) : value),
  // `| md5` — returns the MD5 hash of a string as a lowercase hex digest.
  md5: value => (typeof value === 'string' ? md5Hex(value) : value)
};
