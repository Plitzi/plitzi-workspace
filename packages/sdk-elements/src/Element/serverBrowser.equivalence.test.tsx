// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ComponentContextValue, Element } from '@plitzi/sdk-shared';
import type { PlitziContextValue } from '@plitzi/sdk-shared/hooks';

vi.mock('@plitzi/sdk-event-bridge', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-event-bridge')>()),
  useEventBridge: () => undefined
}));

// The remote loader closes a cycle through the package index (see element.golden.test.tsx); no local element uses it.
vi.mock('./PluginRemote', () => ({ default: () => null }));

vi.mock('@plitzi/sdk-interactions', async importOriginal => {
  const { createContext } = await import('react');

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-interactions')>()),
    InteractionsContext: createContext({
      interactionsManager: { interactionTrigger: () => undefined },
      useInteractions: () => ({})
    })
  };
});

vi.mock('@plitzi/sdk-shared/plugins/react', async importOriginal => {
  const { createContext } = await import('react');

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-shared/plugins/react')>()),
    PluginsContext: createContext({ plugins: {} })
  };
});

const definition = (type: string, items?: string[]): Element['definition'] => ({
  rootId: 'box',
  label: type,
  type,
  styleSelectors: { base: `${type}-base` },
  ...(items ? { items } : {})
});

/** A page's worth of what an element reads: a template, a binding, its own state, a layout, a list of data. */
const flat: Record<string, Element> = {
  box: { id: 'box', attributes: {}, definition: definition('container', ['title', 'bound', 'kept', 'rows', 'inner']) },
  title: {
    id: 'title',
    attributes: { content: 'Hi {{ props.name }}' },
    definition: { ...definition('text'), parentId: 'box' }
  },
  bound: {
    id: 'bound',
    attributes: { content: 'unbound' },
    definition: {
      ...definition('text'),
      parentId: 'box',
      bindings: { attributes: [{ id: 'b1', source: 'variables.headline', to: 'content', enabled: true }] }
    }
  },
  kept: { id: 'kept', attributes: { content: 'state' }, definition: { ...definition('text'), parentId: 'box' } },
  rows: {
    id: 'rows',
    attributes: { source: 'controlled', items: [{ id: 'a' }, { id: 'b' }], subType: 'ol' },
    definition: { ...definition('list', []), parentId: 'box' }
  },
  inner: { id: 'inner', attributes: {}, definition: { ...definition('container', ['leaf']), parentId: 'box' } },
  leaf: { id: 'leaf', attributes: { content: 'leaf' }, definition: { ...definition('text'), parentId: 'inner' } }
};

const settings = { previewMode: true, debugMode: false } as const;

/**
 * The page drawn by a fresh copy of the package: as the page server loads it (no `window`), or as a browser does. The
 * choice between the two is made when a module is loaded, so each draw loads every module again.
 */
const draw = async (inBrowser: boolean): Promise<string> => {
  vi.resetModules();
  if (inBrowser) {
    vi.stubGlobal('window', globalThis);
  }

  const [{ createElement }, { renderToString }, { StoreProvider }, { ComponentContext }, { PlitziContext }] =
    await Promise.all([
      import('react'),
      import('react-dom/server'),
      import('@plitzi/nexus/react'),
      import('@plitzi/sdk-shared/elements'),
      import('@plitzi/sdk-shared/hooks')
    ]);
  const [{ default: Container }, { default: Text }, { default: List }] = await Promise.all([
    import('../elements/structure/Container/Container'),
    import('../elements/basic/Text/Text'),
    import('../elements/structure/List/List')
  ]);

  // A test double of the contexts the SDK provides: only what the elements drawn here read of them.
  const plitzi = { settings, root: { baseElementId: 'box' } } as unknown as PlitziContextValue;
  const components = {
    components: { current: { container: Container, text: Text, list: List } },
    componentDefinitions: { current: {} }
  } as unknown as ComponentContextValue;

  return renderToString(
    createElement(
      StoreProvider,
      {
        value: {
          schema: { flat },
          runtime: {
            sources: { props: { name: 'Ana' }, variables: { headline: 'Bound headline' } },
            elements: { kept: { className: 'from-state' } }
          }
        }
      },
      createElement(
        PlitziContext,
        { value: plitzi },
        createElement(
          ComponentContext,
          { value: components },
          createElement(Container, { internalProps: { id: 'box', rootId: 'box' } })
        )
      )
    )
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// The page server draws with lighter variants of the element's hooks (no subscription, no effect, no error boundary);
// what hydration compares is the markup, so the two must write the same, to the character.
describe('an element on the server and in the browser', () => {
  // Its first draw loads the package's whole graph cold — React's server renderer, the store, sdk-shared — which takes
  // under a second alone and measured 24 s with the workspace's every suite beside it: its own budget, so a busy machine
  // is not read as a broken page.
  it('writes the same markup', { timeout: 120_000 }, async () => {
    const onServer = await draw(false);
    const inBrowser = await draw(true);

    expect(onServer).toContain('Hi Ana');
    expect(onServer).toContain('Bound headline');
    expect(onServer).toContain('data-plitzi-el="leaf"');
    expect(onServer).toContain('<ol');
    expect(inBrowser).toBe(onServer);
  });
});
