import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { HIDDEN_CLASS } from '@plitzi/sdk-shared/style';

import { Audience } from './Audience';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

import type { AudienceProps } from './Audience';
import type { VisitorFacts } from '@plitzi/sdk-shared/audiences';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

const rule = (field: string, value: string) => ({ combinator: 'and', rules: [{ field, operator: '=', value }] });

/** An audience of three variants: one for phones, one for Spanish speakers, and everyone else. */
const flat = {
  phones: { id: 'phones', attributes: { when: rule('visitor.device', 'mobile') }, definition: {} },
  spanish: { id: 'spanish', attributes: { when: rule('visitor.language', 'es') }, definition: {} },
  rest: { id: 'rest', attributes: { when: { combinator: 'and', rules: [] } }, definition: {} }
};

const entry = elementEntry('audience', {
  plitziJsxSkipHOC: true,
  definition: {
    rootId: 'root',
    label: 'Audience',
    type: 'audience',
    styleSelectors: { base: '' },
    items: ['phones', 'spanish', 'rest']
  }
});

const drawn = (visitor: VisitorFacts, props: AudienceProps = {}, surface: Record<string, unknown> = {}) =>
  render(
    <StoreProvider value={{ schema: { flat }, visitor, render: surface, navigation: {} }}>
      <ElementContext value={entry}>
        <Audience {...props}>
          <p key="phones">For phones</p>
          <p key="spanish">Para ti</p>
          <p key="rest">For everyone</p>
        </Audience>
      </ElementContext>
    </StoreProvider>
  );

const desktop = (language: string): VisitorFacts => ({ returning: false, language, device: 'desktop' });

describe('Audience', () => {
  it('draws the first variant whose rule the visitor matches, and none of the others', () => {
    drawn({ returning: false, language: 'es', device: 'mobile' });

    expect(screen.getByText('For phones')).toBeTruthy();
    expect(screen.queryByText('Para ti')).toBeNull();
  });

  it('draws the variant with no conditions for everybody the others did not take', () => {
    const { unmount } = drawn(desktop('es'));
    expect(screen.getByText('Para ti')).toBeTruthy();
    unmount();

    drawn(desktop('fr'));
    expect(screen.getByText('For everyone')).toBeTruthy();
  });

  it('takes no room for a visitor no variant is for: an audience with no “everyone else”', () => {
    const onlySome = { ...flat, rest: { ...flat.rest, attributes: { when: rule('visitor.language', 'de') } } };
    const { container } = render(
      <StoreProvider value={{ schema: { flat: onlySome }, visitor: desktop('fr'), render: {}, navigation: {} }}>
        <ElementContext value={entry}>
          <Audience>
            <p key="phones">For phones</p>
            <p key="spanish">Para ti</p>
            <p key="rest">Für dich</p>
          </Audience>
        </ElementContext>
      </StoreProvider>
    );

    expect(container.textContent).toBe('');
    expect(container.firstElementChild?.classList.contains(HIDDEN_CLASS)).toBe(true);
  });

  it('draws the variant its settings name while editing in the builder, and the simulated visitor’s in its preview', () => {
    const { unmount } = drawn(desktop('es'), { builderVariant: 2 }, { builder: true, previewMode: false });
    expect(screen.getByText('For everyone')).toBeTruthy();
    unmount();

    drawn(desktop('es'), { builderVariant: 2 }, { builder: true, previewMode: true });
    expect(screen.getByText('Para ti')).toBeTruthy();
  });
});
