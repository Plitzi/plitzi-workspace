import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PanelSections from './PanelSections';

import type { PanelSection } from './PanelSections';

const SECTIONS: [PanelSection, ...PanelSection[]] = [
  { id: 'variables', label: 'Variables', content: <p>the variables</p> },
  { id: 'flags', label: 'Feature Flags', content: <p>the flags</p> }
];

const stored = () => JSON.parse(localStorage.getItem('builder-state') ?? '{}') as Record<string, unknown>;

// useStorage announces each write a microtask later in tests, and the open section re-reads it then: wait for it.
const settle = () => act(() => Promise.resolve());

afterEach(() => localStorage.clear());

describe('PanelSections', () => {
  it('opens on the first section, and switches to another with its tab', async () => {
    const { getByText, queryByText } = render(<PanelSections name="variables" sections={SECTIONS} />);
    await settle();

    expect(getByText('the variables')).toBeTruthy();
    expect(queryByText('the flags')).toBeNull();

    fireEvent.click(getByText('Feature Flags'));
    await settle();

    expect(getByText('the flags')).toBeTruthy();
    expect(queryByText('the variables')).toBeNull();
  });

  it('remembers the open section under its own name, and comes back to it', async () => {
    const first = render(<PanelSections name="variables" sections={SECTIONS} />);
    await settle();
    fireEvent.click(first.getByText('Feature Flags'));
    await settle();
    first.unmount();

    expect(stored()).toEqual({ panelSections: { variables: 'flags' } });
    expect(render(<PanelSections name="variables" sections={SECTIONS} />).getByText('the flags')).toBeTruthy();
  });

  it('falls back to the first section when the one remembered no longer exists', () => {
    localStorage.setItem('builder-state', JSON.stringify({ panelSections: { variables: 'removed' } }));

    expect(render(<PanelSections name="variables" sections={SECTIONS} />).getByText('the variables')).toBeTruthy();
  });
});
