import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { List } from './List';
import ElementContext from '../../../Element/ElementContext';
import { skipHocEntry } from '../../../testUtils/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

const rowProps: { record: unknown; index: number }[] = [];

vi.mock('./modes/ListControlled/ListControlledItem', () => ({
  default: ({ record, index }: { record: unknown; index: number }) => {
    rowProps.push({ record, index });

    return null;
  }
}));

vi.mock('@plitzi/sdk-shared/dataSource/hooks/useRegisterSource', () => ({ default: () => undefined }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', () => ({
  default: () => ({
    settings: { previewMode: true },
    contexts: {}
  })
}));

describe('List Tests', () => {
  it('Render Component', () => {
    const { baseElement } = render(
      <ElementContext value={skipHocEntry()}>
        <List />
      </ElementContext>
    );

    expect(baseElement).toBeTruthy();
  });
});

/**
 * What each row is told its position is.
 *
 * `list_<id>.index` is what a flow uses to reach back into the array the list is bound to — to drop this row, or to
 * read the entry beside it. It was given `i + 1`, the number the builder's template label shows, and the two are not
 * the same thing: every such flow was quietly off by one and acted on the neighbour. Nothing reported it, because an
 * index that is wrong is still an index.
 *
 * The row is mocked rather than rendered because publishing that value is all this is about — the real one brings
 * the replica and interaction machinery with it, none of which can make this right or wrong.
 */
describe('a controlled list', () => {
  it('gives every row its own position, counting from zero', () => {
    render(
      <ElementContext value={skipHocEntry('todo')}>
        <List source="controlled" items={['first', 'second', 'third']}>
          <span />
        </List>
      </ElementContext>
    );

    expect(rowProps.map(row => ({ record: row.record, index: row.index }))).toEqual([
      { record: 'first', index: 0 },
      { record: 'second', index: 1 },
      { record: 'third', index: 2 }
    ]);
  });
});
