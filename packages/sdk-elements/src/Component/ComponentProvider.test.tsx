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
