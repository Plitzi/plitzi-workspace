import { describe, expect, it, vi } from 'vitest';

import { createElementRegistry } from './ElementRegistryContext';

import type { ElementRegistrySnapshot } from './ElementRegistryContext';

const snapshot = (plugins: ElementRegistrySnapshot['plugins'] = {}): ElementRegistrySnapshot => ({
  components: { current: {} },
  componentDefinitions: { current: {} },
  plugins
});

describe('createElementRegistry', () => {
  it('tells its followers of a registry that changed, and of nothing else', () => {
    const initial = snapshot();
    const registry = createElementRegistry(initial);
    const follower = vi.fn();
    registry.subscribe(follower);

    // The same objects, handed again on a render of the provider: nothing joined, so nobody is told.
    registry.set({ ...initial });
    expect(follower).not.toHaveBeenCalled();

    const next = { ...initial, plugins: {} };
    registry.set(next);
    expect(follower).toHaveBeenCalledOnce();
    expect(registry.get()).toBe(next);
  });

  it('stops telling a follower that left', () => {
    const registry = createElementRegistry(snapshot());
    const follower = vi.fn();
    const leave = registry.subscribe(follower);
    leave();

    registry.set(snapshot());
    expect(follower).not.toHaveBeenCalled();
  });
});
