import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CURRENT_SELECTOR } from '@plitzi/sdk-shared/style/styleStates';

import { Pagination } from './Pagination';

import type { ReactNode } from 'react';

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', async () => {
  const { createContext } = await import('react');

  return {
    default: () => ({
      settings: { previewMode: true },
      contexts: { InteractionsContext: createContext({ interactionsManager: { interactionTrigger: vi.fn() } }) }
    })
  };
});

vi.mock('@plitzi/sdk-shared/store', () => ({ useSdkStore: () => [vi.fn()] }));

vi.mock('../../../Element/hooks/useElement', () => ({
  default: () => ({
    id: 'pager',
    definition: {
      label: 'Pagination',
      styleSelectors: {
        base: '',
        previous: 'pager-prev',
        page: 'pager-page',
        next: 'pager-next',
        loadMore: 'pager-more'
      }
    }
  })
}));

vi.mock('../../../Element/RootElement', () => ({
  default: ({ children, tag = 'div' }: { children?: ReactNode; tag?: string }) => {
    const Tag = tag as 'div';

    return <Tag>{children}</Tag>;
  }
}));

describe('Pagination', () => {
  it('puts the class of each slot on its buttons, and marks the page shown as the current one', () => {
    const { container } = render(<Pagination pageInfo={{ page: 2, pageCount: 3, hasNextPage: true }} />);
    const buttons = [...container.querySelectorAll('button')];

    expect(buttons.map(button => button.classList.contains('pager-prev'))).toEqual([true, false, false, false, false]);
    expect(buttons.filter(button => button.classList.contains('pager-page')).map(button => button.textContent)).toEqual(
      ['1', '2', '3']
    );
    expect(buttons[4].classList.contains('pager-next')).toBe(true);
    expect(container.querySelector(`.pager-page${CURRENT_SELECTOR}`)?.textContent).toBe('2');
  });

  it('disables the button with nowhere to go, for the disabled state to dress', () => {
    const { container } = render(<Pagination pageInfo={{ page: 1, pageCount: 1 }} />);

    expect(container.querySelector('.pager-prev:disabled')).not.toBeNull();
    expect(container.querySelector('.pager-next:disabled')).not.toBeNull();
  });

  it('puts the loadMore class on the button of a load-more pager', () => {
    const { container } = render(<Pagination mode="loadMore" pageInfo={{ page: 1, hasNextPage: true }} />);

    expect(container.querySelector('button')?.className).toBe('plitzi-component__pagination-more pager-more');
  });
});
