import { render } from '@testing-library/react';
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

    expect(container.querySelector('polyline.chart__line')).toBeTruthy();
    expect(container.querySelectorAll('circle.chart__point')).toHaveLength(3);
    expect([...container.querySelectorAll('text.chart__value')].map(text => text.textContent)).toEqual(['4', '7', '5']);
  });

  it('draws a donut a slice a row, with its legend of shares', () => {
    const { container } = render(inElement(<Chart kind="donut" items={days} />));

    expect(container.querySelectorAll('path.chart__slice')).toHaveLength(3);
    expect(container.querySelector('.chart__legend')?.textContent).toContain('Tue · 7 (44%)');
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
