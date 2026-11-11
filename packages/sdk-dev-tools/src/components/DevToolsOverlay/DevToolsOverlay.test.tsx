// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import DevToolsOverlay from './DevToolsOverlay';

import type { DevToolsOverlayProps } from './DevToolsOverlay';
import type { ReactNode } from 'react';

const part = vi.hoisted(() => (name: string) => ({ default: () => createElement('p', null, name) }));

vi.mock('../DevToolsIndicator', () => part('badge'));
vi.mock('../DevToolsPanel', () => part('panel'));
vi.mock('../../qa/QaLayer', () => part('qa layer'));
vi.mock('../../qa/QaContext', () => ({
  QaProvider: ({ collapsed, children }: { collapsed: boolean; children: ReactNode }) =>
    createElement('section', { 'data-collapsed': String(collapsed) }, children)
}));

const props = (over: Partial<DevToolsOverlayProps> = {}): DevToolsOverlayProps => ({
  collapsed: true,
  orientation: 'horizontal',
  tabSelected: 'logs',
  onOpen: () => undefined,
  onCollapse: () => undefined,
  onTabSelect: () => undefined,
  onChangeOrientation: () => undefined,
  qa: false,
  run: false,
  ...over
});

const overlay = (over: Partial<DevToolsOverlayProps>) => render(<DevToolsOverlay {...props(over)} />);

const shown = () => screen.getAllByText(/^(badge|panel|qa layer)$/).map(node => node.textContent);

describe('DevToolsOverlay', () => {
  it('is the badge while folded and the panel while open, never both', () => {
    const { rerender } = overlay({});

    expect(shown()).toEqual(['badge']);

    rerender(<DevToolsOverlay {...props({ collapsed: false })} />);

    expect(shown()).toEqual(['panel']);
  });

  it('keeps the QA layer under both where QA is offered, told whether the panel is folded', () => {
    const { container } = overlay({ qa: true });

    expect(shown()).toEqual(['qa layer', 'badge']);
    expect(container.querySelector('section')?.dataset.collapsed).toBe('true');
  });

  it('draws no QA layer where QA is not offered', () => {
    const { container } = overlay({ collapsed: false });

    expect(container.querySelector('section')).toBeNull();
    expect(shown()).toEqual(['panel']);
  });
});
