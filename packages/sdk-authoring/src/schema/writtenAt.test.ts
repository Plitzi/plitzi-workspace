import { afterEach, describe, expect, it, vi } from 'vitest';

import { component, text } from '../index';
import { carryWrittenAt, markWrittenAt, writtenAt } from './writtenAt';

describe('writtenAt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a spec in a browser bundle whose `process` shim has no `cwd`', () => {
    // Vite's shim carries `env` and nothing else, and the desktop app authors its rail in the renderer: asking the
    // shim for a working directory took the whole window down.
    vi.stubGlobal('process', { env: {} });
    const spec = markWrittenAt({});

    expect(() => writtenAt(spec)).not.toThrow();
  });

  it('answers nothing for a spec no factory marked', () => {
    expect(writtenAt({})).toBeUndefined();
  });

  // A spread copies only what is enumerable: a factory that rebuilt a spec handed back one written nowhere, and
  // `plitzi where` could not place a component's instance nor `plitzi edit` change its props.
  it('carries the original marker through a copy, never a new one', () => {
    const marker = (spec: object): unknown =>
      Object.getOwnPropertySymbols(spec)
        .filter(symbol => symbol.description === 'plitzi.writtenAt')
        .map((symbol): unknown => Reflect.get(spec, symbol))[0];
    const written = markWrittenAt({ id: 'a' });

    expect(marker(carryWrittenAt(written, { ...written }))).toBe(marker(written));
  });

  it('marks a component instance, and keeps the marker of each child it places in a slot', () => {
    const marker = (spec: object): unknown =>
      Object.getOwnPropertySymbols(spec).find(symbol => symbol.description === 'plitzi.writtenAt');
    const child = text('Hi', { id: 'hi' });
    const instance = component('card', { id: 'card-1', props: { title: 'A' }, children: { body: [child] } });

    expect(marker(instance)).toBeDefined();
    expect(instance.children?.map(marker)).toEqual([marker(child)]);
  });
});
