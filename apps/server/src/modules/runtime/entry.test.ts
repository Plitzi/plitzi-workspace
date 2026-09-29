import { expect, it } from 'vitest';

/**
 * The runtime entry is loaded by the platform's page server too (`createRuntimeProxyStage`). Loading it must leave the
 * process's `fetch` as Node made it: `undici` installs a global dispatcher the moment it is imported — one that, in
 * 8.11.0, left every compressed answer unread — so only a runtime that asks for `reachSpaceInside` loads it.
 */
it('leaves Node’s own dispatcher in place when it is loaded', async () => {
  const key = Symbol.for('undici.globalDispatcher.1');
  // Node sets its own the first time its fetch is touched; touched here, so there is one to compare with.
  new Response('');
  const nodes: unknown = Reflect.get(globalThis, key);

  await import('../../runtime');

  expect(nodes).toBeDefined();
  expect(Reflect.get(globalThis, key)).toBe(nodes);
});
