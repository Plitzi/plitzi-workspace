import { render } from '@testing-library/react';
import { use } from 'react';
import { describe, it, expect } from 'vitest';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import ComponentProvider from './ComponentProvider';

import type { ComponentContextValue, ComponentPluginWithHOC } from '@plitzi/sdk-shared';

const makeComponent = (type: string): ComponentPluginWithHOC => {
  const Comp = (() => null) as unknown as ComponentPluginWithHOC;
  Comp.type = type;

  return Comp;
};

const setup = () => {
  let api!: ComponentContextValue;
  const Probe = () => {
    api = use(ComponentContext);

    return null;
  };
  render(
    <ComponentProvider>
      <Probe />
    </ComponentProvider>
  );

  return () => api;
};

describe('ComponentProvider registry', () => {
  it('registers a remote component and resolves it via getComponent', () => {
    const getApi = setup();
    const remote = makeComponent('myRemote');

    const appended = getApi().register(remote);

    expect(Object.keys(appended)).toContain('myRemote');
    expect(getApi().getComponent('myRemote')).toBe(remote);
  });

  it('does not re-register an already known type', () => {
    const getApi = setup();
    getApi().register(makeComponent('dup'));

    const second = getApi().register(makeComponent('dup'));

    expect(Object.keys(second)).toHaveLength(0);
  });

  it('removes a registered component via unregister', () => {
    const getApi = setup();
    getApi().register(makeComponent('temp'));
    expect(getApi().getComponent('temp')).toBeDefined();

    getApi().unregister('temp');

    expect(getApi().getComponent('temp')).toBeUndefined();
  });
});

/**
 * A host's plugins can change after the provider mounted — a plugin the server could not import is handed over only
 * once hydration is done, and an application may add a `<PlitziSdk.Plugin>` later. The registry was built once, so
 * such a plugin was never in it and its element rendered nothing at all.
 */
describe('ComponentProvider plugins handed over after mount', () => {
  it('resolves a plugin the host adds later, keeps what was registered, and tells its consumers', () => {
    const seen: ComponentContextValue[] = [];
    const Probe = () => {
      seen.push(use(ComponentContext));

      return null;
    };
    const late = makeComponent('late');
    const { rerender } = render(
      <ComponentProvider localCustomComponents={{}}>
        <Probe />
      </ComponentProvider>
    );
    const first = seen[seen.length - 1];
    first.register(makeComponent('remote'));

    rerender(
      <ComponentProvider localCustomComponents={{ late }}>
        <Probe />
      </ComponentProvider>
    );
    const latest = seen[seen.length - 1];

    expect(latest.components.current.late).toBeDefined();
    expect(latest.components.current.remote).toBeDefined();
    // A new registry object is what a consumer memoised on it recomputes from.
    expect(latest.components).not.toBe(first.components);
  });
});
