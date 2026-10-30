import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UnitTests from './UnitTests';

import type { UnitTest } from '@plitzi/sdk-shared';

const tests: UnitTest[] = [
  { id: 'shows', title: 'Hello shows', element: 'hello', expect: [{ kind: 'visible', value: true }] },
  {
    id: 'lit',
    title: 'App is lit',
    element: 'plan',
    expect: [{ kind: 'variant', className: 'pill', value: 'current' }]
  }
];

describe('the unit tests listed', () => {
  it('says how each stands — what a failed one read — and edits by its id', () => {
    const onEdit = vi.fn();
    render(
      <UnitTests
        tests={tests}
        results={[
          { id: 'shows', title: 'Hello shows', ok: true, misses: [], problem: null },
          {
            id: 'lit',
            title: 'App is lit',
            ok: false,
            misses: ["pill's variant current expected, it is its base"],
            problem: null
          }
        ]}
        problems={[]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getByText('Passes')).toBeTruthy();
    expect(screen.getByText('Fails')).toBeTruthy();
    expect(screen.getByText("pill's variant current expected, it is its base")).toBeTruthy();
    fireEvent.click(screen.getAllByText('Edit')[1]);
    expect(onEdit).toHaveBeenCalledWith('lit');
  });

  it('starts empty, saying what a unit test is for', () => {
    render(<UnitTests tests={[]} results={[]} problems={[]} onAdd={vi.fn()} onEdit={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText('No element checks yet')).toBeTruthy();
  });

  it('marks a check that needs a look, and says what is wrong under it', () => {
    render(
      <UnitTests
        tests={tests}
        results={[]}
        problems={['unit test "lit": no element "plan" in the space — name one by its id']}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(screen.getAllByRole('img', { name: /^Needs a look/ })).toHaveLength(1);
    expect(screen.getByText('No element "plan" in the space — name one by its id.')).toBeTruthy();
  });
});
