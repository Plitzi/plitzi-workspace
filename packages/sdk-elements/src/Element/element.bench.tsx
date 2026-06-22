import { render, cleanup } from '@testing-library/react';
import { createContext } from 'react';
import { bench, vi, afterEach } from 'vitest';

import StoreProvider from '@plitzi/nexus/StoreProvider';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziServiceContext } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { ElementStoreProvider } from './ElementStore';
import Text from '../elements/basic/Text/Text';
import Container from '../elements/structure/Container/Container';

import type { ComponentContextValue, Element, PlitziServiceContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

vi.mock('@plitzi/sdk-event-bridge/hooks/useEventBridge', () => ({ default: () => undefined }));
vi.mock('./PluginRemote', () => ({ default: () => null }));

const InteractionsContext = createContext({
  interactionsManager: { interactionTrigger: () => undefined },
  useInteractions: () => ({})
});
const PluginsContext = createContext({ plugins: {} });

const serviceValue = {
  settings: { previewMode: true, debugMode: false },
  root: { baseElementId: 'root' },
  contexts: { InteractionsContext, PluginsContext, BuilderContext: undefined }
} as unknown as PlitziServiceContextValue;

const components = {
  components: { current: { container: Container, text: Text } }
} as unknown as ComponentContextValue;

const textEl = (id: string): Element => ({
  id,
  attributes: { content: `t-${id}` },
  definition: { rootId: 'root', label: id, type: 'text', styleSelectors: { base: id } }
});

const containerEl = (id: string, items: string[]): Element => ({
  id,
  attributes: {},
  definition: { rootId: 'root', label: id, type: 'container', styleSelectors: { base: id }, items }
});

// Flat tree: one root container holding `count` text children.
const flatSchema = (count: number): Record<string, Element> => {
  const flat: Record<string, Element> = {};
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `t${i}`;
    items.push(id);
    flat[id] = textEl(id);
  }
  flat.root = containerEl('root', items);

  return flat;
};

// Nested tree: a chain of `depth` containers ending in a text leaf.
const nestedSchema = (depth: number): Record<string, Element> => {
  const flat: Record<string, Element> = {};
  for (let i = 0; i < depth; i++) {
    flat[`c${i}`] = containerEl(`c${i}`, [i === depth - 1 ? 'leaf' : `c${i + 1}`]);
  }
  flat.leaf = textEl('leaf');
  flat.root = containerEl('root', ['c0']);

  return flat;
};

const renderTree = (flat: Record<string, Element>): ReactNode => (
  <StoreProvider value={{ schema: { flat }, runtime: { sources: {} } }}>
    <PlitziServiceContext value={serviceValue}>
      <ElementStoreProvider>
        <ComponentContext value={components}>
          <Container internalProps={{ id: 'root', rootId: 'root' }} />
        </ComponentContext>
      </ElementStoreProvider>
    </PlitziServiceContext>
  </StoreProvider>
);

const flat200 = flatSchema(200);
const flat500 = flatSchema(500);
const nested80 = nestedSchema(80);

afterEach(() => cleanup());

bench('mount flat 200 text', () => {
  render(renderTree(flat200));
  cleanup();
});

bench('mount flat 500 text', () => {
  render(renderTree(flat500));
  cleanup();
});

bench('mount nested depth 80', () => {
  render(renderTree(nested80));
  cleanup();
});
