import { render, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';

import ThemeProvider from './ThemeProvider';
import themeStore, { setThemeMode } from './themeStore';
import useTheme from './useTheme';

import type { ThemeScope } from './ThemeProvider';
import type { ReactNode } from 'react';

const Reader = ({ onValue }: { onValue: (value: ReturnType<typeof useTheme>) => void }) => {
  onValue(useTheme());

  return null;
};

const mount = (scope: ThemeScope, children: ReactNode) =>
  render(
    <StoreProvider value={{}}>
      <ThemeProvider scope={scope} cookieName="test-theme" defaultTheme="light">
        {children}
      </ThemeProvider>
    </StoreProvider>
  );

describe('ThemeProvider scope', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.cookie = 'test-theme=;path=/;max-age=0';
    act(() => setThemeMode('system'));
  });

  it('stamps the document when the surface is the page', () => {
    mount('document', null);

    expect(document.documentElement.className).toBe('light');
  });

  /**
   * The desktop window: its chrome reads the document class, and the space it embeds must not be able to repaint it.
   */
  it('touches nothing outside itself when embedded', () => {
    document.documentElement.classList.add('dark');
    mount('container', null);

    expect(document.documentElement.className).toBe('dark');
  });

  it('gives an embedded surface a theme of its own', () => {
    let embedded: ReturnType<typeof useTheme> | undefined;
    mount('container', <Reader onValue={value => (embedded = value)} />);

    expect(embedded?.theme).toBe('light');

    // The surface around it changes its mind; the embedded space keeps the theme it was showing.
    act(() => setThemeMode('dark'));

    expect(embedded?.theme).toBe('light');
    expect(themeStore.getState().mode).toBe('dark');
  });

  it('leaves the surface store alone when an embedded space changes its own theme', () => {
    let embedded: ReturnType<typeof useTheme> | undefined;
    mount('container', <Reader onValue={value => (embedded = value)} />);

    act(() => embedded?.setTheme('dark'));

    expect(embedded?.theme).toBe('dark');
    expect(themeStore.getState().mode).toBe('system');
    expect(document.documentElement.className).toBe('');
  });
});
