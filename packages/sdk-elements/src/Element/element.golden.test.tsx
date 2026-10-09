import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';
import { PlitziContext } from '@plitzi/sdk-shared/hooks/usePlitzi';

import Text from '../elements/basic/Text/Text';
import List from '../elements/structure/List/List';

import type { ComponentContextValue, Element, PlitziContextValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

vi.mock('@plitzi/sdk-event-bridge/hooks/useEventBridge', () => ({ default: () => undefined }));

// PluginRemote pulls the remote loader → Component registry → package index, a circular chain that breaks module
// init order under vitest. Local elements never use it, so stub it to keep the pipeline graph acyclic for the test.
vi.mock('./PluginRemote', () => ({ default: () => null }));

vi.mock('@plitzi/sdk-interactions/InteractionsContext', async () => {
  const { createContext } = await import('react');

  return {
    default: createContext({
      interactionsManager: { interactionTrigger: () => undefined },
      useInteractions: () => ({})
    })
  };
});

vi.mock('@plitzi/sdk-shared/plugins/PluginsContext', async () => {
  const { createContext } = await import('react');

  return { default: createContext({ plugins: {} }) };
});

const serviceValue = {
  settings: { previewMode: true, debugMode: false },
  root: { baseElementId: 'root' }
} as unknown as PlitziContextValue;

const element: Element = {
  id: 'el1',
  attributes: { content: 'Hello World' },
  definition: { rootId: 'root', label: 'My Text', type: 'text', styleSelectors: { base: 'el1-base' } }
};

/** One with a parent: inside a component, everything but its root. */
const child: Element = { ...element, id: 'child', definition: { ...element.definition, parentId: 'el1' } };

/** One that arrives as it scrolls into view, after a beat, and keeps floating. */
const moving: Element = {
  ...element,
  id: 'moving',
  definition: { ...element.definition, motion: { enter: 'fade-up', on: 'view', delay: 120, loop: 'float' } }
};

/** A list of data, and one numbered. */
const listOf = (id: string, subType?: 'ul' | 'ol'): Element => ({
  id,
  attributes: { source: 'controlled', items: [{ id: 'a' }, { id: 'b' }], ...(subType ? { subType } : {}) },
  definition: { rootId: 'root', label: 'Rows', type: 'list', items: [], styleSelectors: { base: '' } }
});

const rows = listOf('rows');
const steps = listOf('steps', 'ol');

const renderTree = (children: ReactNode, settings?: Partial<PlitziContextValue['settings']>) =>
  render(
    <StoreProvider value={{ schema: { flat: { el1: element, child, moving, rows, steps } }, runtime: { sources: {} } }}>
      <PlitziContext value={{ ...serviceValue, settings: { ...serviceValue.settings, ...settings } }}>
        <ComponentContext
          value={
            { components: { current: {} }, componentDefinitions: { current: {} } } as unknown as ComponentContextValue
          }
        >
          {children}
        </ComponentContext>
      </PlitziContext>
    </StoreProvider>
  );

describe('Element pipeline (golden)', () => {
  it('renders a Text element through withElement + RootElement', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.innerHTML).toMatchSnapshot();
  });

  /**
   * The handle an end-to-end suite addresses this element by.
   *
   * Asserted separately from the golden snapshot because it is a CONTRACT, not an incidental detail of the markup:
   * a spec written against `handles.hero.cta` resolves to this attribute and nothing else, so losing it breaks
   * every suite downstream while the snapshot merely records that the markup changed.
   */
  it('carries the element id as a test handle', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.querySelector('[data-plitzi-el="el1"]')).not.toBeNull();
  });

  /** A component's instance has no node of its own: its root carries the instance's name, and only its root. */
  it('names the instance on a component’s root — not on a page’s root, nor on an element with a parent', () => {
    const instanceOf = (id: string, layoutRoot: string) =>
      renderTree(
        <Text
          internalProps={{
            id,
            rootId: layoutRoot,
            plitziElementLayout: { slots: [], rootId: layoutRoot, type: 'component' }
          }}
        />
      ).container.querySelector(`[data-plitzi-el="${id}"]`);

    expect(instanceOf('el1', 'hero-card')?.getAttribute('data-plitzi-instance')).toBe('hero-card');
    expect(instanceOf('el1', 'el1')?.hasAttribute('data-plitzi-instance')).toBe(false);
    expect(instanceOf('child', 'hero-card')?.hasAttribute('data-plitzi-instance')).toBe(false);
  });

  it('carries its declared motion as what the stylesheet plays — and an element without one, nothing', () => {
    const { container } = renderTree(
      <>
        <Text internalProps={{ id: 'moving', rootId: 'root' }} />
        <Text internalProps={{ id: 'el1', rootId: 'root' }} />
      </>
    );
    const node = container.querySelector<HTMLElement>('[data-plitzi-el="moving"]');

    expect(node?.dataset).toMatchObject({ motionEnter: 'fade-up', motionOn: 'view', motionLoop: 'float' });
    expect(node?.style.getPropertyValue('--plitzi-motion-delay')).toBe('120ms');
    expect(
      container
        .querySelector('[data-plitzi-el="el1"]')
        ?.getAttributeNames()
        .filter(name => name.startsWith('data-motion'))
    ).toEqual([]);
  });

  it('renders a list of data as the list it is — a `<ul>`, or the `<ol>` its subType asks for', () => {
    const { container } = renderTree(
      <>
        <List internalProps={{ id: 'rows', rootId: 'root' }} />
        <List internalProps={{ id: 'steps', rootId: 'root' }} />
      </>
    );

    expect(container.querySelector('[data-plitzi-el="rows"]')?.tagName).toBe('UL');
    expect(container.querySelector('[data-plitzi-el="steps"]')?.tagName).toBe('OL');
  });

  it('leaves the handle off when the deployment turns test attributes off', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />, {
      testAttributes: false
    });

    expect(container.querySelector('[data-plitzi-el]')).toBeNull();
  });

  it('resolves the content attribute into the rendered text', () => {
    const { getByText } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(getByText('Hello World')).toBeTruthy();
  });

  /**
   * A component's props are all there when its tree renders, so one an instance left out prints nothing. Any other
   * empty token is kept for a later pass that knows more, as it always was.
   */
  it('prints nothing for a prop the instance left out, and keeps a token that is still waiting', () => {
    const templated: Element = { ...element, attributes: { content: '{{ props.blurb }}|{{ redirect }}' } };
    const { container } = render(
      <StoreProvider value={{ schema: { flat: { el1: templated } }, runtime: { sources: { props: { blurb: null } } } }}>
        <PlitziContext value={serviceValue}>
          <ComponentContext
            value={
              { components: { current: {} }, componentDefinitions: { current: {} } } as unknown as ComponentContextValue
            }
          >
            <Text internalProps={{ id: 'el1', rootId: 'root' }} />
          </ComponentContext>
        </PlitziContext>
      </StoreProvider>
    );

    expect(container.querySelector('[data-plitzi-el="el1"]')?.textContent).toBe('|{{ redirect }}');
  });

  it('applies the element base style selector class to the root node', () => {
    const { container } = renderTree(<Text internalProps={{ id: 'el1', rootId: 'root' }} />);

    expect(container.querySelector('.plitzi-component__text')).not.toBeNull();
    expect(container.querySelector('.el1-base')).not.toBeNull();
  });
});
