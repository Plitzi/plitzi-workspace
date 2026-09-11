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

  /** A surface that states no default follows the machine: nothing is stamped, so the media queries answer. */
  it('leaves the choice to the machine when nothing was chosen and no default was given', () => {
    let surface: ReturnType<typeof useTheme> | undefined;
    render(
      <StoreProvider value={{}}>
        <ThemeProvider cookieName="test-theme">
          <Reader onValue={value => (surface = value)} />
        </ThemeProvider>
      </StoreProvider>
    );

    expect(surface?.theme).toBe('system');
    expect(document.documentElement.className).toBe('');
  });

  it('stamps the document when the surface is the page', () => {
    mount('document', null);

    expect(document.documentElement.className).toBe('light');
  });

  it('starts the page from the choice in its cookie', () => {
    document.cookie = 'test-theme=dark;path=/';
    mount('document', null);

    expect(document.documentElement.className).toBe('dark');
  });

  /**
   * The cookie on this origin is the page's, not the embedded space's — and in development the desktop shares
   * `localhost` with every other app on another port. A space that started from their `theme=dark` came up dark
   * inside a window that was light.
   */
  it('starts an embedded surface from its default, never from the page cookie', () => {
    document.cookie = 'test-theme=dark;path=/';
    let embedded: ReturnType<typeof useTheme> | undefined;
    mount('container', <Reader onValue={value => (embedded = value)} />);

    expect(embedded?.theme).toBe('light');
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
