import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ThemeToggle } from './ThemeToggle';

import type { Theme } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

/**
 * What the control has to be right about is not its looks — the space styles it — but three things it cannot get
 * away with: the markup it hands the browser must not depend on stored state, a click has to reach the theme, and
 * a page listening for the scheme has to be told when it moves and only when it moves.
 */

// Hoisted with the mock that uses it: a `vi.mock` factory runs before the module's own top-level statements.
const { toggleTheme, setTheme, interactionTrigger, currentTheme } = vi.hoisted(() => ({
  toggleTheme: vi.fn(),
  setTheme: vi.fn(),
  interactionTrigger: vi.fn(),
  currentTheme: { value: 'dark' }
}));

vi.mock('@plitzi/sdk-shared/theme/useTheme', () => ({
  default: () => ({
    theme: currentTheme.value,
    resolvedTheme: currentTheme.value === 'system' ? 'light' : currentTheme.value,
    setTheme,
    toggleTheme
  })
}));

// `withElement` reaches the element catalogue, and importing that from Node is the TDZ cycle this package has a
// note about. A component test wants the component, so the HOC is the identity here.
vi.mock('../../../Element/hocs/withElement', () => ({ default: (element: unknown) => element }));

vi.mock('@plitzi/sdk-shared/hooks/usePlitziServiceContext', async () => {
  const { createContext } = await import('react');

  return {
    default: () => ({
      settings: { previewMode: true },
      contexts: { InteractionsContext: createContext({ interactionsManager: { interactionTrigger } }) }
    })
  };
});

vi.mock('../../../Element/hooks/useElement', () => ({
  default: () => ({
    id: 'toggle',
    idRef: 'toggle',
    definition: { label: 'Theme Toggle', styleSelectors: { base: '', icon: '', option: '' } }
  })
}));

// The real one registers triggers and reads element state; here it is the tag it would have rendered, minus the
// props that belong to the element system rather than to the DOM.
vi.mock('../../../Element/RootElement', () => ({
  default: ({ children, tag = 'div', ...props }: { children?: ReactNode; tag?: string }) => {
    const Tag = tag as 'div';
    const { interactionTriggers, ...rest } = props as { interactionTriggers?: unknown };

    return (
      <Tag {...rest} data-triggers={interactionTriggers ? 'yes' : undefined}>
        {children}
      </Tag>
    );
  }
}));

/** Puts the store's answer where the test wants it before the control reads it. */
const atTheme = (theme: Theme, children: ReactNode) => {
  currentTheme.value = theme;

  return children;
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    interactionTrigger.mockClear();
  });

  it('renders both schemes whatever the current one is, so server and browser agree', () => {
    const { container } = render(<ThemeToggle />);

    // A control that rendered only the active icon would either flash the wrong one on every load or hold the
    // page back until storage answered.
    expect(container.querySelector('[data-theme-icon="light"]')).not.toBeNull();
    expect(container.querySelector('[data-theme-icon="dark"]')).not.toBeNull();
  });

  it('flips the theme when it is clicked', () => {
    const { container } = render(<ThemeToggle />);

    fireEvent.click(container.querySelector('button') as HTMLButtonElement);

    expect(toggleTheme).toHaveBeenCalled();
  });

  it('tells the page when the theme moved, and says nothing on the first render', () => {
    const { rerender } = render(atTheme('dark', <ThemeToggle />));

    // A page reacting to the scheme must not be told it changed simply because the control appeared.
    expect(interactionTrigger).not.toHaveBeenCalled();

    rerender(atTheme('light', <ThemeToggle />));

    expect(interactionTrigger).toHaveBeenCalledWith('toggle', 'onThemeChange', { theme: 'light' });
  });

  it('offers the machine its say back when asked for the segmented form', () => {
    const { getByText, container } = render(<ThemeToggle subType="segmented" showSystem />);

    expect(container.querySelectorAll('button')).toHaveLength(3);

    fireEvent.click(getByText('System'));

    expect(setTheme).toHaveBeenCalledWith('system');
  });
});
