// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DevToolsHeader from './DevToolsHeader';

import type { ScopeSelector } from '../../scope/useScope';

const scope = vi.hoisted(() => {
  const selector: ScopeSelector = { options: [], value: undefined, onSelect: () => undefined };

  return { selector };
});

const scrollIntoView = vi.fn();

vi.mock('../../scope/useScope', () => ({ useScopeSelector: () => scope.selector }));

const narrow = vi.hoisted(() => ({ value: false }));

vi.mock('../../useNarrowWindow', async () => ({
  ...(await vi.importActual<object>('../../useNarrowWindow')),
  default: () => narrow.value
}));

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent);

beforeEach(() => {
  scope.selector = { options: [], value: undefined, onSelect: () => undefined };
  narrow.value = false;
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe('DevToolsHeader', () => {
  it('offers QA and Run only where they are', () => {
    const { rerender } = render(<DevToolsHeader orientation="vertical" tabSelected="logs" />);

    expect(tabNames()).not.toContain('QA');
    expect(tabNames()).not.toContain('Run');

    rerender(<DevToolsHeader orientation="vertical" tabSelected="logs" qa run />);

    expect(tabNames()).toContain('QA');
    expect(tabNames()).toContain('Run');
  });

  it('marks the tab shown, keeps it in sight and says which one is chosen', () => {
    const onTabSelect = vi.fn();
    render(<DevToolsHeader orientation="vertical" tabSelected="store" onTabSelect={onTabSelect} />);

    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Store');
    expect(scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Flags' }));

    expect(onTabSelect).toHaveBeenCalledWith('flags');
  });

  it('switches between the side and the bottom, and collapses', () => {
    const onChangeOrientation = vi.fn();
    const onCollapse = vi.fn();
    const { rerender } = render(
      <DevToolsHeader orientation="vertical" onChangeOrientation={onChangeOrientation} onCollapse={onCollapse} />
    );
    fireEvent.click(screen.getByTitle('Switch to bottom panel'));

    expect(onChangeOrientation).toHaveBeenLastCalledWith('horizontal');

    rerender(<DevToolsHeader orientation="horizontal" onChangeOrientation={onChangeOrientation} />);
    fireEvent.click(screen.getByTitle('Switch to side panel'));

    expect(onChangeOrientation).toHaveBeenLastCalledWith('vertical');

    rerender(
      <DevToolsHeader orientation="horizontal" onChangeOrientation={onChangeOrientation} onCollapse={onCollapse} />
    );
    fireEvent.click(screen.getByTitle('Collapse to the indicator'));

    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it('stays at the bottom on a narrow window, and says why', () => {
    narrow.value = true;
    const onChangeOrientation = vi.fn();
    render(<DevToolsHeader orientation="horizontal" onChangeOrientation={onChangeOrientation} />);
    const toggle = screen.getByTitle(/At the bottom while the window is under/);

    expect(toggle.closest('button')?.disabled).toBe(true);

    fireEvent.click(toggle);

    expect(onChangeOrientation).not.toHaveBeenCalled();
  });

  it('lists the stores by instance and picks one', () => {
    const onSelect = vi.fn();
    scope.selector = {
      options: [
        {
          label: 'sdk',
          options: [
            { value: '1', label: 'root' },
            { value: '2', label: 'Queries' }
          ]
        }
      ],
      value: '1',
      onSelect
    };
    render(<DevToolsHeader orientation="vertical" />);
    const select = screen.getByTitle<HTMLSelectElement>('Instance / StoreProvider driving the panel');

    expect(select.value).toBe('1');
    expect(select.querySelector('optgroup')?.label).toBe('sdk');

    fireEvent.change(select, { target: { value: '2' } });

    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('draws no scope picker with no store', () => {
    render(<DevToolsHeader orientation="vertical" />);

    expect(screen.queryByTitle('Instance / StoreProvider driving the panel')).toBeNull();
  });
});
