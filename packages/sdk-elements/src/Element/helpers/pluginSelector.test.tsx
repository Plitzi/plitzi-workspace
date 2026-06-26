import { describe, it, expect } from 'vitest';

import pluginSelector from './pluginSelector';
import PluginRemote from '../PluginRemote';

import type { ComponentDefinition, ComponentPluginWithHOC } from '@plitzi/sdk-shared';
import type { FC, ReactElement } from 'react';

const makeComponent = (type: string): ComponentPluginWithHOC => {
  const Comp = (() => null) as unknown as ComponentPluginWithHOC;
  Comp.type = type;

  return Comp;
};

const internalProps = { id: 'el1', rootId: 'root' };

describe('pluginSelector', () => {
  it('renders the local registry component for a known type, passing internalProps', () => {
    const TextComp = makeComponent('text');
    const result = pluginSelector({
      type: 'text',
      internalProps,
      components: { text: TextComp },
      plugins: {}
    }) as ReactElement<{ internalProps: { id: string; rootId: string } }>;

    expect(result.type).toBe(TextComp);
    expect(result.props.internalProps).toMatchObject({ id: 'el1', rootId: 'root' });
  });

  it('falls back to the notFound component for an unknown type', () => {
    const NotFound = makeComponent('notFound') as unknown as FC;
    const result = pluginSelector({
      type: 'ghost',
      internalProps,
      components: { notFound: NotFound as unknown as ComponentPluginWithHOC },
      plugins: {}
    }) as ReactElement;

    expect(result.type).toBe(NotFound);
  });

  it('returns undefined for an empty type when there is no notFound component', () => {
    const result = pluginSelector({ type: '', internalProps, components: {}, plugins: {} });

    expect(result).toBeUndefined();
  });

  it('routes an unknown-but-registered plugin definition to PluginRemote with its asset url and scope', () => {
    const definition = {
      scope: 'myScope',
      subPlugins: [],
      assets: [{ id: 'a', type: 'script', isMain: true, params: { src: 'https://cdn/plugin.js' } }]
    } as unknown as ComponentDefinition;
    const result = pluginSelector({
      type: 'myRemote',
      internalProps,
      components: {},
      plugins: { myRemote: definition }
    }) as ReactElement<{ url: string; scope: string }>;

    expect(result.type).toBe(PluginRemote);
    expect(result.props.url).toBe('https://cdn/plugin.js');
    expect(result.props.scope).toBe('myScope');
  });
});
