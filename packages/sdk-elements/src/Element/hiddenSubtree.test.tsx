import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { ComponentContext } from '@plitzi/sdk-shared/elements';
import { PlitziContext } from '@plitzi/sdk-shared/hooks';
import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';
import { tracingCollector } from '@plitzi/sdk-shared/store/tracing';

import Text from '../elements/basic/Text/Text';
import Container from '../elements/structure/Container/Container';

import type { PathOf } from '@plitzi/nexus';
import type { CommonState, ComponentContextValue, ComponentPluginWithHOC, Element } from '@plitzi/sdk-shared';
import type { PlitziContextValue } from '@plitzi/sdk-shared/hooks';

vi.mock('@plitzi/sdk-event-bridge', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-event-bridge')>()),
  useEventBridge: () => undefined
}));

// The remote loader closes an import cycle under vitest, and no element here is remote.
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

const container = (id: string, items: string[], visibility?: boolean): Element => ({
  id,
  attributes: {},
  definition: {
    rootId: 'root',
    label: id,
    type: 'container',
    items,
    styleSelectors: { base: '' },
    ...(visibility === undefined ? {} : { initialState: { visibility } })
  }
});

const text = (id: string): Element => ({
  id,
  attributes: { content: id },
  definition: { rootId: 'root', label: id, type: 'text', styleSelectors: { base: '' } }
});

// The two element types drawn here, registered as the page registers its components: by type.
const components = { current: { container: Container, text: Text } } as unknown as Record<
  string,
  ComponentPluginWithHOC
>;

const service = {
  settings: { previewMode: true, debugMode: true },
  root: { baseElementId: 'root' }
} as unknown as PlitziContextValue;

/**
 * A section shown once the page knows something (a sidebar as it opens): what is inside it that STAYS hidden — a
 * closed group's links — has nothing new to draw. Every element below one whose visibility changed was drawn again,
 * the hidden ones included, with nothing of theirs changed: a context's change draws every reader below it.
 */
describe('a section that is shown, and what stays hidden inside it', () => {
  it('draws the section and what shows with it, and nothing below what stays hidden', () => {
    // What shows the section: its state written, as a flow writes it.
    let showSection: (() => void) | undefined;
    const Setter = () => {
      const setState = useCommonStoreSetter();
      const path: PathOf<CommonState> = 'runtime.elements.wrap';
      showSection = () => {
        setState(path, { visibility: true });
      };

      return null;
    };
    const flat = {
      wrap: container('wrap', ['shown', 'group'], false),
      shown: text('shown'),
      group: container('group', ['link'], false),
      link: text('link')
    };
    render(
      <StoreProvider value={{ schema: { flat }, runtime: { sources: {}, elements: {} } }}>
        <PlitziContext value={service}>
          <ComponentContext
            value={{ components, componentDefinitions: { current: {} } } as unknown as ComponentContextValue}
          >
            <Setter />
            <Container internalProps={{ id: 'wrap', rootId: 'root' }} />
          </ComponentContext>
        </PlitziContext>
      </StoreProvider>
    );
    const mark = tracingCollector.lastCommitId();

    act(() => {
      showSection?.();
    });

    const drawn = tracingCollector
      .commitsSince(mark)
      .flatMap(commit => commit.elements)
      .filter(render => render.changedProps !== undefined)
      .map(render => `${render.elementId}:${(render.changedProps ?? []).map(change => change.key).join(',')}`);

    // The section and what shows with it; and the group, which has to learn its section's visibility to know it stays
    // hidden — once, and nothing below it. The section's definition is the one it had: showing it changes no selector.
    expect(drawn.sort()).toEqual(['group:', 'shown:visible', 'wrap:visible,attributes,style,elementState']);
  });
});
