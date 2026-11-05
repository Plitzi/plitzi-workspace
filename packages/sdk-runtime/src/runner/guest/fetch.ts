import type { GuestBytes } from './bytes';
import type { GuestEvents } from './events';
import type { Bytes } from './types';

/**
 * Headers, bodies, requests and responses — and how a body crosses to the runner and back.
 *
 * Printed into the isolate on its own, as the guest is (`isolate.ts`): it may use nothing but its parameters.
 */
export const guestFetch = (
  { isRecord, encodeUtf8, decodeUtf8, bytesToBase64, base64ToBytes, copyBytes }: GuestBytes,
  { GuestAbortController }: GuestEvents
) => {
  type GuestAbortSignal = InstanceType<GuestEvents['GuestAbortSignal']>;
  type HeadersInput = GuestHeaders | [string, string][] | Record<string, string>;
  type BodySource = { text: string } | { bytes: Bytes } | null;
  type WireBody = { text: string } | { base64: string };

  const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

  /** A name as headers keep it — refused when it is no header name. */
  const headerName = (name: string): string => {
    if (!TOKEN.test(name)) {
      throw new TypeError(`"${name}" is not a valid header name`);
    }

    return name.toLowerCase();
  };

  /**
   * Each `Headers`' values by name, kept out of the object the code holds — a WeakMap rather than a private field, so
   * the part's type can be named outside it (`GuestFetch`).
   */
  const headerValues = new WeakMap<object, Map<string, string[]>>();

  const valuesOf = (headers: object): Map<string, string[]> => {
    const values = headerValues.get(headers) ?? new Map<string, string[]>();
    headerValues.set(headers, values);

    return values;
  };

  class GuestHeaders {
    constructor(init?: HeadersInput) {
      if (init instanceof GuestHeaders) {
        init.forEach((value, name) => this.append(name, value));
      } else if (Array.isArray(init)) {
        init.forEach(([name, value]) => this.append(name, value));
      } else if (init) {
        Object.entries(init).forEach(([name, value]) => this.append(name, value));
      }
    }

    append(name: string, value: unknown): void {
      const key = headerName(name);
      valuesOf(this).set(key, [...(valuesOf(this).get(key) ?? []), String(value).trim()]);
    }

    set(name: string, value: unknown): void {
      valuesOf(this).set(headerName(name), [String(value).trim()]);
    }

    get(name: string): string | null {
      return valuesOf(this).get(headerName(name))?.join(', ') ?? null;
    }

    getSetCookie(): string[] {
      return [...(valuesOf(this).get('set-cookie') ?? [])];
    }

    has(name: string): boolean {
      return valuesOf(this).has(headerName(name));
    }

    delete(name: string): void {
      valuesOf(this).delete(headerName(name));
    }

    *entries(): IterableIterator<[string, string]> {
      for (const name of [...valuesOf(this).keys()].sort()) {
        if (name === 'set-cookie') {
          for (const value of valuesOf(this).get(name) ?? []) {
            yield [name, value];
          }
        } else {
          yield [name, valuesOf(this).get(name)?.join(', ') ?? ''];
        }
      }
    }

    *keys(): IterableIterator<string> {
      for (const [name] of this.entries()) {
        yield name;
      }
    }

    *values(): IterableIterator<string> {
      for (const [, value] of this.entries()) {
        yield value;
      }
    }

    forEach(callback: (value: string, name: string, headers: GuestHeaders) => void): void {
      for (const [name, value] of this.entries()) {
        callback(value, name, this);
      }
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
      return this.entries();
    }
  }

  const sourceOf = (body: unknown, headers: GuestHeaders): BodySource => {
    const typed = (type: string) => {
      if (!headers.has('content-type')) {
        headers.set('content-type', type);
      }
    };
    if (body === null || body === undefined) {
      return null;
    }

    if (typeof body === 'string') {
      typed('text/plain;charset=UTF-8');

      return { text: body };
    }

    if (body instanceof URLSearchParams) {
      typed('application/x-www-form-urlencoded;charset=UTF-8');

      return { text: body.toString() };
    }

    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      return { bytes: copyBytes(body) };
    }

    throw new TypeError('A body is a string, bytes or URLSearchParams — this runtime has no streams, Blob or FormData');
  };

  /** Each body's source and whether it was read, kept out of the objects the code holds. */
  const bodies = new WeakMap<GuestBody, { source: BodySource; used: boolean }>();

  const take = (body: GuestBody): BodySource => {
    const state = bodies.get(body);
    if (!state) {
      return null;
    }

    if (state.used) {
      throw new TypeError('Body has already been read');
    }

    state.used = state.source !== null;

    return state.source;
  };

  /** A body as it was written, to copy it: text stays text and bytes stay bytes. */
  const peek = (body: GuestBody): string | Bytes | null => {
    const source = bodies.get(body)?.source ?? null;
    if (!source) {
      return null;
    }

    return 'text' in source ? source.text : source.bytes;
  };

  class GuestBody {
    readonly headers: GuestHeaders;

    constructor(body: unknown, headers?: HeadersInput) {
      this.headers = new GuestHeaders(headers);
      bodies.set(this, { source: sourceOf(body, this.headers), used: false });
    }

    get bodyUsed(): boolean {
      return bodies.get(this)?.used ?? false;
    }

    get body(): null {
      return null;
    }

    text(): Promise<string> {
      try {
        const source = take(this);
        if (!source) {
          return Promise.resolve('');
        }

        return Promise.resolve('text' in source ? source.text : decodeUtf8(source.bytes));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new TypeError(String(error)));
      }
    }

    async json(): Promise<unknown> {
      return JSON.parse(await this.text()) as unknown;
    }

    bytes(): Promise<Bytes> {
      try {
        const source = take(this);
        if (!source) {
          return Promise.resolve(new Uint8Array(0));
        }

        return Promise.resolve('text' in source ? encodeUtf8(source.text) : copyBytes(source.bytes));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new TypeError(String(error)));
      }
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
      return (await this.bytes()).buffer;
    }
  }

  const METHODS = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH'];

  type RequestInit = { method?: string; headers?: HeadersInput; body?: unknown; signal?: GuestAbortSignal | null };

  class GuestRequest extends GuestBody {
    readonly url: string;
    readonly method: string;
    readonly signal: GuestAbortSignal;

    constructor(input: string | URL | GuestRequest, init: RequestInit = {}) {
      const from = input instanceof GuestRequest ? input : undefined;
      const method = init.method ?? from?.method ?? 'GET';
      const upper = method.toUpperCase();
      const normal = METHODS.includes(upper) ? upper : method;
      if ((normal === 'GET' || normal === 'HEAD') && init.body !== undefined && init.body !== null) {
        throw new TypeError(`A ${normal} request has no body`);
      }

      super(init.body, init.headers ?? from?.headers);
      this.url = new URL(input instanceof GuestRequest ? input.url : input).href;
      this.method = normal;
      this.signal = init.signal ?? from?.signal ?? new GuestAbortController().signal;
    }

    clone(): GuestRequest {
      return new GuestRequest(this.url, {
        method: this.method,
        headers: this.headers,
        body: peek(this),
        signal: this.signal
      });
    }
  }

  type ResponseInit = { status?: number; statusText?: string; headers?: HeadersInput };

  class GuestResponse extends GuestBody {
    readonly status: number;
    readonly statusText: string;
    readonly type = 'default';
    readonly url = '';
    readonly redirected = false;

    constructor(body?: unknown, init: ResponseInit = {}) {
      super(body, init.headers);
      const status = init.status ?? 200;
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        throw new RangeError(`A response status is 200–599, not ${String(status)}`);
      }

      this.status = status;
      this.statusText = init.statusText ?? '';
    }

    get ok(): boolean {
      return this.status >= 200 && this.status < 300;
    }

    clone(): GuestResponse {
      return new GuestResponse(peek(this), {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers
      });
    }

    static json(data: unknown, init: ResponseInit = {}): GuestResponse {
      const headers = new GuestHeaders(init.headers);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }

      return new GuestResponse(JSON.stringify(data), { ...init, headers });
    }

    static redirect(url: string | URL, status = 302): GuestResponse {
      if (![301, 302, 303, 307, 308].includes(status)) {
        throw new RangeError(`${String(status)} is not a redirect status`);
      }

      return new GuestResponse(null, { status, headers: { location: new URL(String(url)).href } });
    }
  }

  /** Text back as text and bytes as base64: what the code wrote crosses unchanged, and nothing is decided from its type. */
  const wireOf = (body: GuestBody): WireBody | null => {
    const source = take(body);
    if (!source) {
      return null;
    }

    return 'text' in source ? { text: source.text } : { base64: bytesToBase64(source.bytes) };
  };

  const headerPairs = (value: unknown): [string, string][] =>
    Array.isArray(value)
      ? value.flatMap((pair: unknown) =>
          Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string'
            ? [[pair[0], pair[1]] satisfies [string, string]]
            : []
        )
      : [];

  const bodyOfWire = (body: unknown): string | Bytes | null => {
    if (!isRecord(body)) {
      return null;
    }

    if (typeof body.text === 'string') {
      return body.text;
    }

    return typeof body.base64 === 'string' ? base64ToBytes(body.base64) : null;
  };

  return { GuestHeaders, GuestRequest, GuestResponse, wireOf, headerPairs, bodyOfWire };
};

export type GuestFetch = ReturnType<typeof guestFetch>;
