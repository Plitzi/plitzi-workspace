import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { HIDDEN_CLASS } from '@plitzi/sdk-shared/style';

import { Variants } from './Variants';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { VariantsProps } from './Variants';
import type { VisitorFacts } from '@plitzi/sdk-shared/audiences';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

const rule = (field: string, value: string) => ({ combinator: 'and', rules: [{ field, operator: '=', value }] });

/** Three variants: one for phones, one for Spanish speakers, and everyone else — read when chosen by rules. */
const ruled = {
  first: { id: 'first', attributes: { when: rule('visitor.device', 'mobile') }, definition: {} },
  second: { id: 'second', attributes: { when: rule('visitor.language', 'es') }, definition: {} },
  third: { id: 'third', attributes: { when: { combinator: 'and', rules: [] } }, definition: {} }
};

const entry = elementEntry('pricing-test', {
  plitziJsxSkipHOC: true,
  definition: {
    rootId: 'root',
    label: 'Variants',
    type: 'variants',
    styleSelectors: { base: '' },
    items: ['first', 'second', 'third']
  }
});

const desktop = (language: string): VisitorFacts => ({ returning: false, language, device: 'desktop', country: '' });

/** The element drawn in a store holding the space's variants, the visitor and what the surface says. */
const drawn = (props: VariantsProps, store: Record<string, unknown> = {}, flat: Record<string, unknown> = ruled) =>
  render(
    <StoreProvider value={{ schema: { flat }, navigation: {}, visitor: desktop('en'), ...store }}>
      <ElementContext value={entry}>
        <Variants {...props}>
          <p key="first">First</p>
          <p key="second">Second</p>
          <p key="third">Third</p>
        </Variants>
      </ElementContext>
    </StoreProvider>
  );

const assigned = (experiments: Record<string, string>) => ({ runtime: { sources: { experiments } } });

describe('Variants chosen by chance', () => {
  it('draws the variant the visitor was given, and not the others at all', () => {
    drawn({ experiment: 'heroTest' }, assigned({ heroTest: 'c' }));

    expect(screen.getByText('Third')).toBeTruthy();
    expect(screen.queryByText('First')).toBeNull();
  });

  it('runs under the element’s own name until it is given one', () => {
    drawn({ experiment: '' }, assigned({ pricing_test: 'b' }));

    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('draws A for a visitor not given one yet', () => {
    drawn({ experiment: 'heroTest' });

    expect(screen.getByText('First')).toBeTruthy();
  });
});

describe('Variants chosen by rules', () => {
  it('draws the first variant whose rule the visitor matches', () => {
    const { unmount } = drawn(
      { chooseBy: 'rules' },
      { visitor: { returning: false, language: 'es', device: 'mobile' } }
    );
    expect(screen.getByText('First')).toBeTruthy();
    unmount();

    drawn({ chooseBy: 'rules' }, { visitor: desktop('es') });
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('draws the one with no conditions for everybody the others did not take', () => {
    drawn({ chooseBy: 'rules' }, { visitor: desktop('fr') });

    expect(screen.getByText('Third')).toBeTruthy();
  });

  it('takes no room for a visitor no variant is for', () => {
    const onlySome = { ...ruled, third: { ...ruled.third, attributes: { when: rule('visitor.language', 'de') } } };
    const { container } = drawn({ chooseBy: 'rules' }, { visitor: desktop('fr') }, onlySome);

    expect(container.textContent).toBe('');
    expect(container.firstElementChild?.classList.contains(HIDDEN_CLASS)).toBe(true);
  });
});

describe('Variants in the builder', () => {
  it('draws while editing the variant its settings name, whatever a visitor would be shown', () => {
    drawn(
      { experiment: 'heroTest', builderVariant: 1 },
      { ...assigned({ heroTest: 'a' }), render: { builder: true, previewMode: false } }
    );

    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.queryByText('First')).toBeNull();
  });

  it('draws in its preview the simulated visitor’s, by rules as by chance', () => {
    drawn(
      { chooseBy: 'rules', builderVariant: 2 },
      { visitor: desktop('es'), render: { builder: true, previewMode: true } }
    );

    expect(screen.getByText('Second')).toBeTruthy();
  });
});
