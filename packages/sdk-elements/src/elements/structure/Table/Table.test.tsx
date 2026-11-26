import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import { Table } from './Table';
import { TableColumn } from './TableColumn/TableColumn';
import useElementDataSource from '../../../Element/hooks/useElementDataSource';

import type { ReactNode } from 'react';

// The table's own tags are what is checked: the element frame draws the tag it is handed, with its attributes.
vi.mock('../../../Element/RootElement', () => ({
  default: ({ tag = 'div', children, ...props }: { tag?: string; children?: ReactNode }) =>
    createElement(tag, props, children)
}));

vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('../../../Element/hooks/useElement', () => ({
  default: () => ({ id: 'plans', definition: { label: 'Plans', styleSelectors: { base: '' } } })
}));

vi.mock('../../../dataSource/useRegisterSource', () => ({ default: () => undefined }));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: true } })
}));

// Each row is a replica scope, which reads the interactions manager from this context.
vi.mock('@plitzi/sdk-interactions', async importOriginal => {
  const { createContext } = await import('react');
  const manager = { createChildManager: () => manager, removeChildManager: () => undefined };

  return {
    ...(await importOriginal<typeof import('@plitzi/sdk-interactions')>()),
    InteractionsContext: createContext({ interactionsManager: manager })
  };
});

type Plan = { id: string; name: string; price: string };

/** A cell's content: a field of the row's item, read off the source the table publishes (`table_plans`). */
const Field = ({ name }: { name: keyof Plan }) => {
  const source = useElementDataSource({ sources: ['table_plans'] });
  const item = (source.table_plans as { item?: Plan } | undefined)?.item;

  return <>{item?.[name]}</>;
};

const drawn = (items: Plan[]) =>
  render(
    <StoreProvider value={{}}>
      <Table items={items} caption="Plans compared">
        <TableColumn header="Plan" rowHeader>
          <Field name="name" />
        </TableColumn>
        <TableColumn header="Price">
          <Field name="price" />
        </TableColumn>
      </Table>
    </StoreProvider>
  ).container;

describe('Table', () => {
  it('is a table: its caption, a head of column headers and a row per item, each column its cell', () => {
    const table = drawn([
      { id: 'site', name: 'Site', price: '9 €' },
      { id: 'app', name: 'App', price: '29 €' }
    ]);

    expect(table.querySelector('table > caption')?.textContent).toBe('Plans compared');
    expect([...table.querySelectorAll('thead th')].map(th => [th.textContent, th.getAttribute('scope')])).toEqual([
      ['Plan', 'col'],
      ['Price', 'col']
    ]);
    expect(
      [...table.querySelectorAll('tbody tr')].map(row =>
        [...row.children].map(cell => `${cell.tagName}:${cell.textContent}`)
      )
    ).toEqual([
      ['TH:Site', 'TD:9 €'],
      ['TH:App', 'TD:29 €']
    ]);
    expect(table.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
  });

  it('draws its head alone when it has no rows', () => {
    const table = drawn([]);

    expect(table.querySelectorAll('thead th')).toHaveLength(2);
    expect(table.querySelectorAll('tbody tr')).toHaveLength(0);
  });
});
