import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PanelSections from './PanelSections';

import type { PanelSection } from './PanelSections';

const SECTIONS: [PanelSection, ...PanelSection[]] = [
  { id: 'variables', label: 'Variables', content: <p>the variables</p> },
  { id: 'flags', label: 'Feature Flags', content: <p>the flags</p> }
];

const stored = () => JSON.parse(localStorage.getItem('builder-state') ?? '{}') as Record<string, unknown>;

afterEach(() => localStorage.clear());

describe('PanelSections', () => {
  it('opens on the first section, and switches to another with its tab', () => {
    const { getByText, queryByText } = render(<PanelSections name="variables" sections={SECTIONS} />);

    expect(getByText('the variables')).toBeTruthy();
    expect(queryByText('the flags')).toBeNull();

    fireEvent.click(getByText('Feature Flags'));

    expect(getByText('the flags')).toBeTruthy();
    expect(queryByText('the variables')).toBeNull();
  });

  it('remembers the open section under its own name, and comes back to it', () => {
    const first = render(<PanelSections name="variables" sections={SECTIONS} />);
    fireEvent.click(first.getByText('Feature Flags'));
    first.unmount();

    expect(stored()).toEqual({ panelSections: { variables: 'flags' } });
    expect(render(<PanelSections name="variables" sections={SECTIONS} />).getByText('the flags')).toBeTruthy();
  });

  it('falls back to the first section when the one remembered no longer exists', () => {
    localStorage.setItem('builder-state', JSON.stringify({ panelSections: { variables: 'removed' } }));

    expect(render(<PanelSections name="variables" sections={SECTIONS} />).getByText('the variables')).toBeTruthy();
  });
});
