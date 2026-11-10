import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { createIsolateRunner, PBKDF2_MAX_ITERATIONS } from './isolate';
import { bundleOf, invoke, messageOf, reasonOf, valueOf } from './tests/guest';

import type { IsolateRunner } from './isolate';

/**
 * What the code finds in an isolate — the web's APIs, none of Node's, a fresh start each time — and what a runner keeps
 * between invocations. Moved from `sdk-actions` (RFC 0033 T3.1); what the engine adds on top (the catalogue, kv,
 * signing, metering) is tested there.
 */

const runner = createIsolateRunner({ concurrency: 4 });

afterAll(async () => {
  await runner.close?.();
});

describe("a guest's runtime", () => {
  it("has the web's APIs and none of Node's", async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        const bytes = new TextEncoder().encode('héllo €');
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('k'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
        const signature = await crypto.subtle.sign('HMAC', key, bytes);
        const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
        await new Promise(resolve => setTimeout(resolve, 5));
        const url = new URL('/a?b=1', 'https://x.example.com');
        const response = Response.json({ ok: true }, { status: 201 });
        return {
          text: new TextDecoder().decode(bytes),
          digest: hex(digest),
          hmac: hex(signature),
          verified: await crypto.subtle.verify('HMAC', key, signature, bytes),
          uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(crypto.randomUUID()),
          url: url.searchParams.get('b') + url.host,
          clone: structuredClone({ a: [1] }),
          response: [response.status, await response.json()],
          base64: atob(btoa('ok')),
          node: [typeof process, typeof globalThis.require, typeof Buffer]
        };`),
      { cpuMs: 1000 }
    );
    const data = Buffer.from('héllo €');

    expect(valueOf(outcome)).toEqual({
      text: 'héllo €',
      digest: createHash('sha256').update(data).digest('hex'),
      hmac: createHmac('sha256', 'k').update(data).digest('hex'),
      verified: true,
      uuid: true,
      url: '1x.example.com',
      clone: { a: [1] },
      response: [201, { ok: true }],
      base64: 'ok',
      node: ['undefined', 'undefined', 'undefined']
    });
  });

  it('derives from a password with PBKDF2, as bits or as an HMAC key', async () => {
    const outcome = await invoke(
      runner,
      bundleOf(`
        const encode = text => new TextEncoder().encode(text);
        const hex = buffer => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
        const password = await crypto.subtle.importKey('raw', encode('hunter2'), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
        const pbkdf2 = { name: 'PBKDF2', hash: 'SHA-256', salt: encode('salt'), iterations: 1000 };
        const signing = await crypto.subtle.deriveKey(pbkdf2, password, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
        return {
          bits: hex(await crypto.subtle.deriveBits(pbkdf2, password, 256)),
          signed: hex(await crypto.subtle.sign('HMAC', signing, encode('board')))
        };`),
      { cpuMs: 1000 }
    );
    const derived = pbkdf2Sync('hunter2', 'salt', 1000, 32, 'sha256');

    expect(valueOf(outcome)).toEqual({
      bits: derived.toString('hex'),
      signed: createHmac('sha256', derived).update('board').digest('hex')
    });
  });

  it("refuses a key used for what it was not imported for, and a derivation past the runner's bounds", async () => {
    const attempt = async (body: string) =>
      valueOf(
        await invoke(
          runner,
          bundleOf(`
            const encode = text => new TextEncoder().encode(text);
            const pbkdf2 = iterations => ({ name: 'PBKDF2', hash: 'SHA-256', salt: encode('salt'), iterations });
            try { ${body} } catch (error) { return error.name + ': ' + error.message; }`),
          { cpuMs: 1000 }
        )
      );
    const password = 'await crypto.subtle.importKey("raw", encode("pw"), "PBKDF2", false, ["deriveBits"])';
    const hmac =
      'await crypto.subtle.importKey("raw", encode("k"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])';

    expect(await attempt(`await crypto.subtle.deriveBits(pbkdf2(1000), ${hmac}, 256);`)).toBe(
      'InvalidAccessError: deriveBits takes a PBKDF2 key, from crypto.subtle.importKey'
    );
    expect(await attempt(`await crypto.subtle.sign('HMAC', ${hmac}, encode('x'));`)).toBe(
      'InvalidAccessError: The key was not imported for sign'
    );
    expect(await attempt('await crypto.subtle.importKey("raw", encode("pw"), "PBKDF2", true, ["deriveBits"]);')).toBe(
      'SyntaxError: A PBKDF2 key is never extractable'
    );
    expect(
      await attempt(`await crypto.subtle.deriveBits(pbkdf2(${String(PBKDF2_MAX_ITERATIONS + 1)}), ${password}, 256);`)
    ).toBe(`OperationError: PBKDF2 iterations is a whole number from 1 to ${String(PBKDF2_MAX_ITERATIONS)}`);
    expect(await attempt(`await crypto.subtle.deriveBits(pbkdf2(1000), ${password}, 12);`)).toBe(
      'OperationError: A PBKDF2 length is a multiple of 8 bits'
    );
  });

  it('reaches the network only through ctx.fetch', async () => {
    const outcome = await invoke(runner, bundleOf('return (await fetch("https://api.example.com/")).status;'));

    expect(reasonOf(outcome)).toBe('error');
    expect(messageOf(outcome)).toContain('through ctx.fetch');
  });

  it('starts every invocation from nothing, its top level too', async () => {
    const bundle = bundleOf(
      'globalThis.count = (globalThis.count ?? 0) + 1; return [globalThis.count, globalThis.loaded];',
      'globalThis.loaded = (globalThis.loaded ?? 0) + 1;'
    );
    await invoke(runner, bundle);

    expect(await invoke(runner, bundle)).toEqual({ value: [1, 1] });
  });
});

describe('what a runner keeps', () => {
  const invocation: Parameters<IsolateRunner['invoke']>[0]['invocation'] = {
    kind: 'task',
    name: 'probe.run',
    params: {},
    context: { spaceId: 1, environment: 'main', runId: 'r', trigger: 'call', callerId: 'x' }
  };
  const LIMITS = { cpuMs: 1000, wallMs: 5000, memoryMb: 64, outputBytes: 100_000, calls: 10 };
  const codeOf = (value: string, padding: number) =>
    `export default { tasks: [{ namespace: 'probe', action: 'run', run: () => '${value}' }] };\n// ${'x'.repeat(padding)}`;
  const firstInvocation = (fresh: IsolateRunner, id: string, load: () => Promise<string>) =>
    fresh.invoke({
      bundle: { id, load },
      invocation,
      limits: LIMITS,
      answer: () => Promise.resolve(null),
      signal: new AbortController().signal
    });

  it("asks for a bundle's code only when it does not keep it, and lets the oldest go past its bytes", async () => {
    const small = createIsolateRunner({ cacheBytes: 3000 });
    const loadA = vi.fn(() => Promise.resolve(codeOf('a', 1500)));
    const loadB = vi.fn(() => Promise.resolve(codeOf('b', 1500)));

    expect(await firstInvocation(small, 'a', loadA)).toBe('a');
    expect(await firstInvocation(small, 'a', loadA)).toBe('a');
    expect(loadA).toHaveBeenCalledTimes(1);

    expect(await firstInvocation(small, 'b', loadB)).toBe('b');
    expect(await firstInvocation(small, 'a', loadA)).toBe('a');
    expect(loadA).toHaveBeenCalledTimes(2);
  });

  // What warming leaves done, rather than how long the first invocation then takes: a timing beside a cold runner lost
  // whenever the machine ran every package's tests at once.
  it('is ready before its first invocation once warmed', async () => {
    const { default: ivm } = await import('isolated-vm');
    const load = () => Promise.resolve(codeOf('w', 0));
    const warmed = createIsolateRunner();
    await warmed.warm();
    const createSnapshot = vi.spyOn(ivm.Isolate, 'createSnapshot');

    try {
      await firstInvocation(warmed, 'first', load);

      expect(createSnapshot).not.toHaveBeenCalled();

      // …which a runner nobody warmed builds on its first invocation, on the visitor's time.
      await firstInvocation(createIsolateRunner(), 'first', load);

      expect(createSnapshot).toHaveBeenCalledTimes(1);
    } finally {
      createSnapshot.mockRestore();
    }
  });
});
