import type { changeKv } from '../../actions/runtime/kvChange';
import type { createFunctionsDriver, describeFunctions } from '../driver';

/** What the runner hands the guest: calls into the runner's own process, the only way out of the isolate. */
export type GuestHost = {
  /** A {@link FunctionCall} for the platform, as JSON; answers a `FunctionAnswer`, as JSON. */
  call: (message: string) => Promise<string>;
  /** Resolves after `ms` — the runner's clock, bounded by the invocation's time. */
  sleep: (ms: number) => Promise<void>;
  /** `length` random bytes, from the runner's CSPRNG. */
  random: (length: number) => number[];
  /** A `crypto.subtle` operation the runner does with its own implementation: `{ op, … }` → a `FunctionAnswer` whose
   *  value is the bytes, base64. */
  crypto: (message: string) => Promise<string>;
};

/**
 * Functions of the platform's the guest runs as they are, printed in beside it (`isolate.ts`) — one implementation for
 * native code and the sandbox alike. Each is self-contained by contract, as the guest is.
 */
export type GuestShared = {
  /** `ctx.kv.change`: the read-change-write loop, over the guest's own `get` and `swap` calls. */
  changeKv: typeof changeKv;
  /** What a definition declares, as a manifest. */
  describeFunctions: typeof describeFunctions;
  /** An invocation of a definition with its `ctx` — the same driver a space runtime runs. */
  createFunctionsDriver: typeof createFunctionsDriver;
};

/** What the runner drives the guest with, once installed. */
export type GuestDriver = {
  /** What a definition declares — the manifest the platform reads and checks — as a `FunctionAnswer` (JSON). */
  describe: (definition: unknown) => string;
  /** Runs one invocation (JSON) of a definition, and answers a `FunctionAnswer` (JSON). Never rejects. */
  invoke: (definition: unknown, invocation: string) => Promise<string>;
  /** The run was aborted: `ctx.signal` fires, for code that listens, before the runner stops it. */
  abort: (reason: string) => void;
};

/**
 * The runtime a space's code finds in an isolate: the web APIs a bare V8 lacks (`Headers`, `Request`, `Response`,
 * `TextEncoder`, `AbortSignal`, timers, `crypto`) and the `ctx` its functions are handed.
 *
 * It is installed by PRINTING this function into the isolate (`installGuest.toString()`), after the prelude that brings
 * `URL`, `atob`, `structuredClone` and `DOMException`. So it may use nothing from outside its own body — no import,
 * no helper beside it — and all it has of the runner is `host`, and the functions in `shared`. Streams are not
 * provided: a body is text or bytes.
 */
export const installGuest = (scope: Record<string, unknown>, host: GuestHost, shared: GuestShared): GuestDriver => {
  type Bytes = Uint8Array<ArrayBuffer>;
  type Listener = (event: GuestEvent) => void;
  type HeadersInput = GuestHeaders | [string, string][] | Record<string, string>;
  type BodySource = { text: string } | { bytes: Bytes } | null;
  type WireBody = { text: string } | { base64: string };
  type Answer = { ok: true; value: unknown } | { ok: false; error: string; refused?: true };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  /**
   * A refusal: what the code threw to tell whoever asked — a wrong password, a full board — rather than a fault. It is
   * `ActionRefusal` from `@plitzi/sdk-server/functions`, known here by its name: the bundle carries its own copy of the
   * class, printed from the platform's (`build.ts`).
   */
  const REFUSAL = 'ActionRefusal';

  const isRefusal = (error: unknown): boolean => error instanceof Error && error.name === REFUSAL;

  const refusal = (message: string): Error => Object.assign(new Error(message), { name: REFUSAL });

  // ---- bytes ----------------------------------------------------------------------------------------------------

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

  // ---- events and abort -----------------------------------------------------------------------------------------

  class GuestEvent {
    readonly type: string;

    constructor(type: string) {
      this.type = type;
    }
  }

  class GuestEventTarget {
    readonly #listeners = new Map<string, Map<Listener, { once: boolean }>>();

    addEventListener(type: string, listener: Listener | null, options?: boolean | { once?: boolean }): void {
      if (!listener) {
        return;
      }

      const listeners = this.#listeners.get(type) ?? new Map<Listener, { once: boolean }>();
      listeners.set(listener, { once: typeof options === 'object' && options.once === true });
      this.#listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: Listener | null): void {
      if (listener) {
        this.#listeners.get(type)?.delete(listener);
      }
    }

    dispatchEvent(event: GuestEvent): boolean {
      const listeners = this.#listeners.get(event.type);
      [...(listeners ?? new Map<Listener, { once: boolean }>())].forEach(([listener, { once }]) => {
        if (once) {
          listeners?.delete(listener);
        }

        listener.call(this, event);
      });

      return true;
    }
  }

  const signals = new WeakMap<GuestAbortSignal, { aborted: boolean; reason: unknown }>();
  const CONSTRUCT = Symbol('AbortSignal');

  class GuestAbortSignal extends GuestEventTarget {
    onabort: Listener | null = null;

    constructor(token?: symbol) {
      super();
      if (token !== CONSTRUCT) {
        throw new TypeError('Illegal constructor: an AbortSignal comes from an AbortController');
      }

      signals.set(this, { aborted: false, reason: undefined });
    }

    get aborted(): boolean {
      return signals.get(this)?.aborted ?? false;
    }

    get reason(): unknown {
      return signals.get(this)?.reason;
    }

    throwIfAborted(): void {
      if (this.aborted) {
        throw this.reason;
      }
    }

    static abort(reason?: unknown): GuestAbortSignal {
      const signal = new GuestAbortSignal(CONSTRUCT);
      abortSignal(signal, reason);

      return signal;
    }

    static timeout(ms: number): GuestAbortSignal {
      const signal = new GuestAbortSignal(CONSTRUCT);
      guestSetTimeout(() => {
        abortSignal(signal, new DOMException('The operation timed out.', 'TimeoutError'));
      }, ms);

      return signal;
    }

    static any(sources: GuestAbortSignal[]): GuestAbortSignal {
      const signal = new GuestAbortSignal(CONSTRUCT);
      const aborted = sources.find(source => source.aborted);
      if (aborted) {
        abortSignal(signal, aborted.reason);

        return signal;
      }

      sources.forEach(source => {
        source.addEventListener('abort', () => abortSignal(signal, source.reason), { once: true });
      });

      return signal;
    }
  }

  const abortSignal = (signal: GuestAbortSignal, reason: unknown): void => {
    const state = signals.get(signal);
    if (!state || state.aborted) {
      return;
    }

    state.aborted = true;
    state.reason = reason === undefined ? new DOMException('This operation was aborted', 'AbortError') : reason;
    const event = new GuestEvent('abort');
    signal.onabort?.call(signal, event);
    signal.dispatchEvent(event);
  };

  class GuestAbortController {
    readonly signal = new GuestAbortSignal(CONSTRUCT);

    abort(reason?: unknown): void {
      abortSignal(this.signal, reason);
    }
  }

  // ---- timers ---------------------------------------------------------------------------------------------------

  const timers = new Set<number>();
  let nextTimer = 1;
  const delayOf = (ms: unknown) => Math.max(0, Number(ms) || 0);

  const guestSetTimeout = (callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number => {
    const id = nextTimer++;
    timers.add(id);
    void host.sleep(delayOf(ms)).then(() => {
      if (timers.delete(id)) {
        callback(...args);
      }
    });

    return id;
  };

  const guestSetInterval = (callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): number => {
    const id = nextTimer++;
    timers.add(id);
    const tick = (): void => {
      void host.sleep(Math.max(1, delayOf(ms))).then(() => {
        if (timers.has(id)) {
          callback(...args);
          tick();
        }
      });
    };
    tick();

    return id;
  };

  const clearTimer = (id?: number): void => {
    if (id !== undefined) {
      timers.delete(id);
    }
  };

  // ---- headers, bodies, requests, responses ---------------------------------------------------------------------

  const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

  class GuestHeaders {
    readonly #values = new Map<string, string[]>();

    constructor(init?: HeadersInput) {
      if (init instanceof GuestHeaders) {
        init.forEach((value, name) => this.append(name, value));
      } else if (Array.isArray(init)) {
        init.forEach(([name, value]) => this.append(name, value));
      } else if (init) {
        Object.entries(init).forEach(([name, value]) => this.append(name, value));
      }
    }

    #name(name: string): string {
      if (!TOKEN.test(name)) {
        throw new TypeError(`"${name}" is not a valid header name`);
      }

      return name.toLowerCase();
    }

    append(name: string, value: unknown): void {
      const key = this.#name(name);
      this.#values.set(key, [...(this.#values.get(key) ?? []), String(value).trim()]);
    }

    set(name: string, value: unknown): void {
      this.#values.set(this.#name(name), [String(value).trim()]);
    }

    get(name: string): string | null {
      return this.#values.get(this.#name(name))?.join(', ') ?? null;
    }

    getSetCookie(): string[] {
      return [...(this.#values.get('set-cookie') ?? [])];
    }

    has(name: string): boolean {
      return this.#values.has(this.#name(name));
    }

    delete(name: string): void {
      this.#values.delete(this.#name(name));
    }

    *entries(): IterableIterator<[string, string]> {
      for (const name of [...this.#values.keys()].sort()) {
        if (name === 'set-cookie') {
          for (const value of this.#values.get(name) ?? []) {
            yield [name, value];
          }
        } else {
          yield [name, this.#values.get(name)?.join(', ') ?? ''];
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

  // ---- crypto ---------------------------------------------------------------------------------------------------

  const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    if (array.byteLength > 65536) {
      throw new DOMException('At most 65536 bytes at a time', 'QuotaExceededError');
    }

    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(host.random(array.byteLength));

    return array;
  };

  const randomUUID = (): string => {
    const bytes = getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const HASHES = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

  const nameOf = (algorithm: unknown): string => {
    const name = typeof algorithm === 'string' ? algorithm : isRecord(algorithm) ? algorithm.name : undefined;

    return typeof name === 'string' ? name.toUpperCase() : '';
  };

  const hashOf = (algorithm: unknown): string => {
    const upper = nameOf(algorithm);
    if (!HASHES.includes(upper)) {
      throw new DOMException(
        `${upper || String(algorithm)} is not a supported hash (${HASHES.join(', ')})`,
        'NotSupportedError'
      );
    }

    return upper;
  };

  /** An HMAC key's length when its algorithm names none: the hash's block, as Web Crypto has it. */
  const blockBitsOf = (hash: string): number => (hash === 'SHA-384' || hash === 'SHA-512' ? 1024 : 512);

  type KeyAlgorithm = { name: 'HMAC'; hash: { name: string } } | { name: 'PBKDF2' };

  /**
   * The two kinds of key this runtime's `crypto.subtle` makes: HMAC, what signing a webhook needs, and PBKDF2, a
   * password to derive from — what keeping a password needs.
   */
  class GuestCryptoKey {
    readonly type = 'secret';
    readonly algorithm: KeyAlgorithm;
    readonly extractable: boolean;
    readonly usages: string[];
    readonly raw: Bytes;

    constructor(raw: Bytes, algorithm: KeyAlgorithm, extractable: boolean, usages: string[]) {
      this.raw = raw;
      this.algorithm = algorithm;
      this.extractable = extractable;
      this.usages = usages;
    }
  }

  const bytesOf = (data: unknown): Bytes => {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      return copyBytes(data);
    }

    throw new TypeError('crypto.subtle takes bytes: an ArrayBuffer or a typed array');
  };

  const cryptoCall = async (message: Record<string, string>): Promise<Bytes> => {
    const answer: unknown = JSON.parse(await host.crypto(JSON.stringify(message)));
    if (!isRecord(answer) || answer.ok !== true || typeof answer.value !== 'string') {
      throw new DOMException(
        isRecord(answer) && typeof answer.error === 'string' ? answer.error : 'The operation failed',
        'OperationError'
      );
    }

    return base64ToBytes(answer.value);
  };

  type KeyOf<N extends KeyAlgorithm['name']> = GuestCryptoKey & { algorithm: Extract<KeyAlgorithm, { name: N }> };

  const isKeyOf = <N extends KeyAlgorithm['name']>(key: unknown, name: N): key is KeyOf<N> =>
    key instanceof GuestCryptoKey && key.algorithm.name === name;

  /** The key an operation was handed, when it is of the kind the operation takes and was imported for it. */
  const keyFor = <N extends KeyAlgorithm['name']>(key: unknown, name: N, usage: string): KeyOf<N> => {
    if (!isKeyOf(key, name)) {
      throw new DOMException(`${usage} takes a ${name} key, from crypto.subtle.importKey`, 'InvalidAccessError');
    }

    if (!key.usages.includes(usage)) {
      throw new DOMException(`The key was not imported for ${usage}`, 'InvalidAccessError');
    }

    return key;
  };

  const hmacOf = (key: unknown, usage: 'sign' | 'verify', data: unknown): Promise<Bytes> => {
    const { algorithm, raw } = keyFor(key, 'HMAC', usage);

    return cryptoCall({
      op: 'hmac',
      hash: algorithm.hash.name,
      key: bytesToBase64(raw),
      data: bytesToBase64(bytesOf(data))
    });
  };

  /** How many rounds and bits a derivation may take is the runner's to say: it is the one doing the work. */
  const pbkdf2Of = (algorithm: unknown, baseKey: unknown, bits: unknown, usage: string): Promise<Bytes> => {
    if (!isRecord(algorithm) || nameOf(algorithm) !== 'PBKDF2') {
      throw new DOMException('This runtime derives with PBKDF2 only', 'NotSupportedError');
    }

    const { raw } = keyFor(baseKey, 'PBKDF2', usage);
    if (typeof algorithm.iterations !== 'number' || typeof bits !== 'number') {
      throw new TypeError('PBKDF2 takes { name, hash, salt, iterations } and a length in bits');
    }

    return cryptoCall({
      op: 'pbkdf2',
      hash: hashOf(algorithm.hash),
      key: bytesToBase64(raw),
      salt: bytesToBase64(bytesOf(algorithm.salt)),
      iterations: String(algorithm.iterations),
      bits: String(bits)
    });
  };

  /** The key `importKey` makes — thrown, not answered, when it is none this runtime has. */
  const importedKey = (
    format: string,
    keyData: unknown,
    algorithm: unknown,
    extractable: boolean,
    usages: string[]
  ): GuestCryptoKey => {
    const name = nameOf(algorithm);
    if (format === 'raw' && name === 'HMAC' && isRecord(algorithm)) {
      return new GuestCryptoKey(
        bytesOf(keyData),
        { name, hash: { name: hashOf(algorithm.hash) } },
        extractable,
        usages
      );
    }

    if (format === 'raw' && name === 'PBKDF2') {
      if (extractable) {
        throw new DOMException('A PBKDF2 key is never extractable', 'SyntaxError');
      }

      return new GuestCryptoKey(bytesOf(keyData), { name }, false, usages);
    }

    throw new DOMException(
      'This runtime imports raw keys for HMAC and PBKDF2 only (format "raw", { name: "HMAC", hash } or "PBKDF2")',
      'NotSupportedError'
    );
  };

  const subtle = {
    digest: async (algorithm: unknown, data: unknown): Promise<ArrayBuffer> =>
      (await cryptoCall({ op: 'digest', hash: hashOf(algorithm), data: bytesToBase64(bytesOf(data)) })).buffer,
    importKey: (
      format: string,
      keyData: unknown,
      algorithm: unknown,
      extractable: boolean,
      usages: string[]
    ): Promise<GuestCryptoKey> =>
      new Promise(resolve => {
        resolve(importedKey(format, keyData, algorithm, extractable, usages));
      }),
    sign: async (_algorithm: unknown, key: unknown, data: unknown): Promise<ArrayBuffer> =>
      (await hmacOf(key, 'sign', data)).buffer,
    verify: async (_algorithm: unknown, key: unknown, signature: unknown, data: unknown): Promise<boolean> => {
      const expected = await hmacOf(key, 'verify', data);
      const given = bytesOf(signature);
      let difference = expected.length ^ given.length;
      expected.forEach((byte, index) => {
        difference |= byte ^ (given[index] ?? 0);
      });

      return difference === 0;
    },
    deriveBits: async (algorithm: unknown, baseKey: unknown, length: unknown): Promise<ArrayBuffer> =>
      (await pbkdf2Of(algorithm, baseKey, length, 'deriveBits')).buffer,
    /** Derives an HMAC key — the one other kind this runtime has. */
    deriveKey: async (
      algorithm: unknown,
      baseKey: unknown,
      derivedKeyAlgorithm: unknown,
      extractable: boolean,
      usages: string[]
    ): Promise<GuestCryptoKey> => {
      if (!isRecord(derivedKeyAlgorithm) || nameOf(derivedKeyAlgorithm) !== 'HMAC') {
        throw new DOMException('This runtime derives HMAC keys only', 'NotSupportedError');
      }

      const hash = hashOf(derivedKeyAlgorithm.hash);
      const length = derivedKeyAlgorithm.length ?? blockBitsOf(hash);
      const raw = await pbkdf2Of(algorithm, baseKey, length, 'deriveKey');

      return new GuestCryptoKey(raw, { name: 'HMAC', hash: { name: hash } }, extractable, usages);
    }
  };

  // ---- the platform, through `host` -----------------------------------------------------------------------------

  const call = async (message: Record<string, unknown>): Promise<unknown> => {
    const answer: unknown = JSON.parse(await host.call(JSON.stringify(message)));
    if (!isRecord(answer) || answer.ok !== true) {
      throw new Error(
        isRecord(answer) && typeof answer.error === 'string' ? answer.error : 'The platform refused the call'
      );
    }

    return answer.value;
  };

  const run = new GuestAbortController();

  const driver = shared.createFunctionsDriver({
    call,
    signal: run.signal,
    responseOf: wire =>
      new GuestResponse(bodyOfWire(wire.body), {
        status: typeof wire.status === 'number' ? wire.status : 502,
        statusText: typeof wire.statusText === 'string' ? wire.statusText : '',
        headers: headerPairs(wire.headers)
      }),
    requestOf: wire =>
      new GuestRequest(String(wire.url), {
        method: String(wire.method),
        headers: headerPairs(wire.headers),
        body: wire.method === 'GET' || wire.method === 'HEAD' ? null : bodyOfWire(wire.body),
        signal: run.signal
      }),
    wireOfResponse: response =>
      Promise.resolve(
        response instanceof GuestResponse
          ? {
              status: response.status,
              statusText: response.statusText,
              headers: [...response.headers],
              body: wireOf(response)
            }
          : undefined
      ),
    changeKv: shared.changeKv,
    refusal
  });

  const { log } = driver;

  const refuseFetch = (): Promise<never> =>
    Promise.reject(
      new TypeError('Functions reach the network through ctx.fetch, which knows the hosts they may reach')
    );

  Object.assign(scope, {
    TextEncoder: GuestTextEncoder,
    TextDecoder: GuestTextDecoder,
    Event: GuestEvent,
    EventTarget: GuestEventTarget,
    AbortSignal: GuestAbortSignal,
    AbortController: GuestAbortController,
    Headers: GuestHeaders,
    Request: GuestRequest,
    Response: GuestResponse,
    setTimeout: guestSetTimeout,
    clearTimeout: clearTimer,
    setInterval: guestSetInterval,
    clearInterval: clearTimer,
    queueMicrotask: (callback: () => void) => {
      void Promise.resolve().then(callback);
    },
    crypto: { getRandomValues, randomUUID, subtle },
    console: { log, info: log, warn: log, error: log, debug: log },
    fetch: refuseFetch
  });

  // ---- the driver -----------------------------------------------------------------------------------------------

  const describe = (definition: unknown): string =>
    JSON.stringify({ ok: true, value: shared.describeFunctions(definition) });

  return {
    describe,
    invoke: async (definition, invocationText) => {
      let answer: Answer;
      try {
        const invocation: unknown = JSON.parse(invocationText);
        answer = { ok: true, value: await driver.invoke(definition, isRecord(invocation) ? invocation : {}) };
      } catch (error) {
        answer = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          ...(isRefusal(error) ? { refused: true as const } : {})
        };
      }

      try {
        return JSON.stringify(answer);
      } catch (error) {
        return JSON.stringify({
          ok: false,
          error: `What the function answered is not JSON: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    },
    abort: reason => {
      run.abort(new DOMException(reason, 'AbortError'));
    }
  };
};
