import { describe, expect, it, vi } from 'vitest';

import { getPopups, isFullViewId } from './utils';

// The panels' own modules are not what is under test: only which entries the sidebar has, and how each opens.
vi.mock('@plitzi/sdk-style/StyleAdvanceEditor', () => ({ default: () => null }));
vi.mock('@pmodules/AI', () => ({ default: () => null }));
vi.mock('@pmodules/Builder/components/BuilderTree', () => ({ default: () => null }));
vi.mock('@pmodules/Elements', () => ({ default: () => null }));
vi.mock('@pmodules/Flags', () => ({ default: () => null }));
vi.mock('@pmodules/Fonts', () => ({ default: () => null }));
vi.mock('@pmodules/Resources', () => ({ default: () => null }));
vi.mock('@pmodules/StateManager/StateManager', () => ({ default: () => null }));
vi.mock('@pmodules/Variables', () => ({ default: () => null }));
vi.mock('../components/AppDirectory', () => ({ default: () => null }));

describe('getPopups', () => {
  it('gives the sidebar one entry per subject, the whole views last and alone while open', () => {
    const { left } = getPopups({});

    expect(left.map(popup => popup.id)).toEqual([
      'elements',
      'pages',
      'variables',
      'assets',
      'layerManager',
      'advanceStyle',
      'stateManager',
      'server',
      'settings'
    ]);
    expect(left.filter(popup => popup.placementSettings?.left?.multi === false).map(popup => popup.id)).toEqual([
      'server',
      'settings'
    ]);
    expect(left.filter(popup => isFullViewId(popup.id)).every(popup => popup.component === undefined)).toBe(true);
  });

  it('opens what was open, ignores an id an older builder kept, and adds the assistant only behind its flag', () => {
    const { left } = getPopups({ activeIds: ['variables', 'history'], platformFlags: { assistanceAI: true } });

    expect(left.filter(popup => popup.active).map(popup => popup.id)).toEqual(['variables']);
    expect(left.at(-1)?.id).toBe('assistant');
    expect(isFullViewId('history')).toBe(false);
  });
});
