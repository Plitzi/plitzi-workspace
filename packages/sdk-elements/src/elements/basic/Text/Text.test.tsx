import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Text } from './Text';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../tests/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

describe('a text on a page', () => {
  // A run's room cards read "Text" where a bound line resolved to nothing.
  it('draws nothing when it has no words — no placeholder — and says it is empty', () => {
    const { container } = render(
      <ElementContext value={skipHocEntry()}>
        <Text />
        <Text content="Phoenix — Netrum" />
        <Text content={0} />
      </ElementContext>
    );
    const drawn = [...container.querySelectorAll('.plitzi-component__text')];

    expect(drawn.map(each => [each.textContent, each.hasAttribute('data-plitzi-empty')])).toEqual([
      ['', true],
      ['Phoenix — Netrum', false],
      ['0', false]
    ]);
  });
});
