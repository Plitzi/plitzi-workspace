import type { Bytes } from './types';

/**
 * Text and bytes, as the guest reads them: UTF-8 both ways, base64, copies — and `TextEncoder`/`TextDecoder`.
 *
 * Printed into the isolate on its own, as the guest is (`isolate.ts`): it may use nothing but its parameters.
 */
export const guestBytes = () => {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const encodeUtf8 = (text: string): Bytes => {
    const out: number[] = [];
    for (const char of text) {
      let code = char.codePointAt(0) ?? 0;
      if (code >= 0xd800 && code <= 0xdfff) {
        code = 0xfffd;
      }

      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
      } else if (code < 0x10000) {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      } else {
        out.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      }
    }

    return new Uint8Array(out);
  };

  /** UTF-8, with U+FFFD for every byte that does not belong to a well-formed sequence — what a web `TextDecoder` does. */
  const decodeUtf8 = (bytes: Uint8Array): string => {
    const points: number[] = [];
    let text = '';
    let index = 0;
    const continuation = (at: number) => at < bytes.length && ((bytes[at] ?? 0) & 0xc0) === 0x80;
    while (index < bytes.length) {
      const lead = bytes[index] ?? 0;
      const length =
        lead < 0x80
          ? 1
          : lead >= 0xc2 && lead < 0xe0
            ? 2
            : lead >= 0xe0 && lead < 0xf0
              ? 3
              : lead >= 0xf0 && lead < 0xf5
                ? 4
                : 0;
      let code = 0xfffd;
      let used = 1;
      if (length === 1) {
        code = lead;
      } else if (length > 1) {
        let valid = true;
        let value = lead & (0xff >> (length + 1));
        for (let offset = 1; offset < length; offset++) {
          if (!continuation(index + offset)) {
            valid = false;
            used = offset;
            break;
          }

          value = (value << 6) | ((bytes[index + offset] ?? 0) & 63);
        }

        const minimum = length === 3 ? 0x800 : length === 4 ? 0x10000 : 0x80;
        if (valid && value >= minimum && value <= 0x10ffff && (value < 0xd800 || value > 0xdfff)) {
          code = value;
          used = length;
        } else if (valid) {
          used = 1;
        }
      }

      points.push(code);
      index += used;
      if (points.length >= 4096) {
        text += String.fromCodePoint(...points);
        points.length = 0;
      }
    }

    return text + String.fromCodePoint(...points);
  };

  const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }

    return btoa(binary);
  };

  const base64ToBytes = (base64: string): Bytes => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  };

  const copyBytes = (view: ArrayBufferView | ArrayBuffer): Bytes => {
    const source =
      view instanceof ArrayBuffer
        ? new Uint8Array(view)
        : new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const bytes = new Uint8Array(source.length);
    bytes.set(source);

    return bytes;
  };

  class GuestTextEncoder {
    readonly encoding = 'utf-8';

    encode(text: unknown = ''): Bytes {
      return encodeUtf8(typeof text === 'string' ? text : String(text));
    }
  }

  class GuestTextDecoder {
    readonly encoding = 'utf-8';

    constructor(label = 'utf-8') {
      if (!['utf-8', 'utf8', 'unicode-1-1-utf-8'].includes(label.toLowerCase())) {
        throw new RangeError(`This runtime decodes UTF-8 only, not "${label}"`);
      }
    }

    decode(input?: ArrayBufferView | ArrayBuffer): string {
      if (!input) {
        return '';
      }

      const text = decodeUtf8(copyBytes(input));

      return text.startsWith('﻿') ? text.slice(1) : text;
    }
  }

  return {
    isRecord,
    encodeUtf8,
    decodeUtf8,
    bytesToBase64,
    base64ToBytes,
    copyBytes,
    GuestTextEncoder,
    GuestTextDecoder
  };
};

export type GuestBytes = ReturnType<typeof guestBytes>;
