import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chart } from './Chart';
import ElementContext from '../../../Element/ElementContext';
import { elementEntry } from '../../../tests/elementTestUtils';

vi.mock('../../../Element/hocs/withElement', () => ({
  default: (element: unknown) => element
}));

const settings = vi.hoisted(() => ({ previewMode: true }));

vi.mock('@plitzi/sdk-shared/hooks', async importOriginal => ({
  ...(await importOriginal<typeof import('@plitzi/sdk-shared/hooks')>()),
  usePlitzi: () => ({ settings: { previewMode: settings.previewMode }, root: { baseElementId: '' } })
}));

const days = [
  { label: 'Mon', value: 4 },
  { label: 'Tue', value: 7 },
  { label: 'Wed', value: 5 }
];

const inElement = (node: React.ReactNode) => <ElementContext value={elementEntry('plays')}>{node}</ElementContext>;

describe('Chart', () => {
  it('draws a bar a row, named, with the rows as a table a screen reader reads', () => {
    const { container, getByRole } = render(inElement(<Chart items={days} label="Plays this week" />));

    expect(container.querySelectorAll('rect.chart__bar')).toHaveLength(3);
    expect(getByRole('figure', { name: 'Plays this week' })).toBeTruthy();
    expect([...container.querySelectorAll('table th')].map(cell => cell.textContent)).toEqual(['Mon', 'Tue', 'Wed']);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws a line through its points, and its values when asked', () => {
    const { container } = render(inElement(<Chart kind="line" items={days} showValues format="compact" />));

    expect(container.querySelector('path.chart__line')).toBeTruthy();
    expect(container.querySelectorAll('circle.chart__point')).toHaveLength(3);
    expect([...container.querySelectorAll('text.chart__value')].map(text => text.textContent)).toEqual(['4', '7', '5']);
  });

  it('draws a donut a slice a row, with its legend of shares', () => {
    const { container } = render(inElement(<Chart kind="donut" items={days} />));

    expect(container.querySelectorAll('path.chart__slice')).toHaveLength(3);
    expect(container.querySelector('.chart__legend')?.textContent).toContain('Tue · 7 (44%)');
  });

  it('draws a line a series, each in its colour, a missing value a gap, and names each in its legend', () => {
    const minutes = [
      { at: '12:00', a: 10, b: 30 },
      { at: '12:01', b: 32 },
      { at: '12:02', a: 14, b: 31 },
      { at: '12:03', a: 15, b: 35 }
    ];
    const { container } = render(
      inElement(
        <Chart
          kind="line"
          items={minutes}
          labelField="at"
          series={[
            { field: 'a', label: 'worker-1' },
            { field: 'b', label: 'worker-2' }
          ]}
        />
      )
    );
    const lines = [...container.querySelectorAll('path.chart__line')];

    // worker-1 breaks at 12:01: its two runs, then worker-2's one.
    expect(lines).toHaveLength(3);
    expect(lines[0]?.getAttribute('style')).toContain('--plitzi-chart-series-1');
    expect(lines[2]?.getAttribute('style')).toContain('--plitzi-chart-series-2');
    expect([...container.querySelectorAll('.chart__legend li')].map(item => item.textContent)).toEqual([
      'worker-1last 15 · max 15',
      'worker-2last 35 · max 35'
    ]);
    expect([...container.querySelectorAll('table thead th')].map(cell => cell.textContent)).toEqual([
      'worker-1',
      'worker-2'
    ]);
  });

  it('hides and shows each series from its legend, several at once, and one alone with ⌘ or Ctrl', () => {
    const { container } = render(
      inElement(
        <Chart
          kind="line"
          items={[
            { at: '12:00', a: 1, b: 2, c: 3 },
            { at: '12:01', a: 3, b: 4, c: 5 }
          ]}
          labelField="at"
          series={[
            { field: 'a', label: 'one' },
            { field: 'b', label: 'two' },
            { field: 'c', label: 'three' }
          ]}
        />
      )
    );
    const legend = () => [...container.querySelectorAll<HTMLButtonElement>('.chart__legend-item')];
    const drawn = () => container.querySelectorAll('[data-series] path.chart__line').length;
    const pressed = () => legend().map(item => item.getAttribute('aria-pressed'));

    fireEvent.click(legend()[0]);
    fireEvent.click(legend()[1]);
    expect([pressed(), drawn()]).toEqual([['false', 'false', 'true'], 1]);

    fireEvent.click(legend()[0]);
    expect([pressed(), drawn()]).toEqual([['true', 'false', 'true'], 2]);

    fireEvent.click(legend()[2], { metaKey: true });
    expect([pressed(), drawn()]).toEqual([['false', 'false', 'true'], 1]);

    fireEvent.click(legend()[2], { ctrlKey: true });
    expect([pressed(), drawn()]).toEqual([['true', 'true', 'true'], 3]);
  });

  it('reads every series at the row the arrow keys move to', () => {
    const { container, getByRole } = render(
      inElement(
        <Chart
          kind="line"
          label="CPU"
          items={[
            { at: '12:00', a: 1, b: 2 },
            { at: '12:01', a: 3, b: 4 }
          ]}
          labelField="at"
          series={[
            { field: 'a', label: 'one' },
            { field: 'b', label: 'two' }
          ]}
        />
      )
    );
    fireEvent.keyDown(getByRole('figure', { name: 'CPU' }), { key: 'End' });

    expect(container.querySelector('.chart__tooltip')?.textContent).toBe('12:013one4two');
  });

  it('points together with the charts of its name, at the row with the same title', () => {
    const minutes = (shift: number) => [
      { tick: '12:00', at: '12:00', a: 1 + shift },
      { tick: '', at: '12:01', a: 2 + shift }
    ];
    const { getByRole, container } = render(
      inElement(
        <>
          <Chart
            kind="line"
            label="One"
            items={minutes(0)}
            labelField="tick"
            valueField="a"
            titleField="at"
            sync="pool"
          />
          <Chart
            kind="line"
            label="Two"
            items={minutes(10)}
            labelField="tick"
            valueField="a"
            titleField="at"
            sync="pool"
          />
        </>
      )
    );
    fireEvent.keyDown(getByRole('figure', { name: 'One' }), { key: 'End' });

    // The second reads its own value at the minute the first points at; its axis wrote 12:00 alone.
    expect([...container.querySelectorAll('.chart__tooltip')].map(tip => tip.textContent)).toEqual([
      '12:012One',
      '12:0112Two'
    ]);
    expect([...container.querySelectorAll('text.chart__axis')].map(text => text.textContent)).toContain('12:00');
    expect([...container.querySelectorAll('text.chart__axis')].map(text => text.textContent)).not.toContain('12:01');
  });

  it('says it is empty on a page, and shows a shape to style on the canvas', () => {
    const page = render(inElement(<Chart items={[]} emptyText="Nothing played yet" />));
    expect(page.container.textContent).toContain('Nothing played yet');
    page.unmount();

    settings.previewMode = false;
    const canvas = render(inElement(<Chart items={[]} />));
    expect(canvas.container.querySelectorAll('rect.chart__bar').length).toBeGreaterThan(0);
    settings.previewMode = true;
  });
});
