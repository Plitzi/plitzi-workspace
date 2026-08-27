/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, use, useSyncExternalStore } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';
import useTheme from '@plitzi/sdk-shared/theme/useTheme';

import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback, Theme } from '@plitzi/sdk-shared';
import type { MouseEvent, ReactNode, RefObject } from 'react';

export type ThemeToggleProps = {
  ref?: RefObject<HTMLElement>;
  className?: string;
  /** `switch` is one control that flips; `segmented` offers the three answers, including giving the machine its
   *  say back. */
  subType?: 'switch' | 'segmented';
  lightLabel?: string;
  darkLabel?: string;
  systemLabel?: string;
  /** Only meaningful for `segmented`: a two-way switch has nowhere to put a third answer. */
  showSystem?: boolean;
};

const noop = () => () => {};
const mounted = () => true;
const hydrating = () => false;

/**
 * A sun and a moon, drawn rather than fetched.
 *
 * Inline SVG so the control needs no icon font, no sprite and no network — and so it inherits `currentColor`,
 * which is what lets a space style it with the same colour token as everything beside it.
 */
const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="4.2" />
    <path
      strokeLinecap="round"
      d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M17.7 6.3l1.5-1.5M4.8 19.2l1.5-1.5"
    />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinejoin="round" d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />
  </svg>
);

/**
 * Light and dark, as a control a page can carry.
 *
 * A space declares its colours per scheme and the machine decides between them — which is right until somebody
 * wants the other one. This is where that decision is made: it writes the choice on the document root, where the
 * space's own stylesheet is already looking for it, and remembers it for the next visit.
 *
 * **What it renders does not depend on the theme.** Both icons are always in the markup and CSS decides which one
 * shows, so the server and the browser agree byte for byte: a control whose markup changed with the stored theme
 * would either flash the wrong icon on every load or force the page to wait for storage before painting.
 */
const ThemeToggle = ({
  ref,
  className = '',
  subType = 'switch',
  lightLabel = 'Light',
  darkLabel = 'Dark',
  systemLabel = 'System',
  showSystem = false
}: ThemeToggleProps) => {
  const { theme, setTheme, toggleTheme } = useTheme();
  const {
    idRef,
    definition: { styleSelectors }
  } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  // False while hydrating and true from the render after it, so the "which one is chosen" marker is only written
  // once the browser is the one rendering. Before that nobody can know what was stored.
  const isMounted = useSyncExternalStore(noop, mounted, hydrating);

  const choose = useCallback(
    (next: Theme) => (event: MouseEvent) => {
      event.preventDefault();
      if (previewMode) {
        setTheme(next);
      }
    },
    [previewMode, setTheme]
  );

  const handleToggle = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      if (previewMode) {
        toggleTheme();
      }
    },
    [previewMode, toggleTheme]
  );

  const options = useMemo(
    () =>
      [
        ...(showSystem ? [{ value: 'system' as const, label: systemLabel, icon: null }] : []),
        { value: 'light' as const, label: lightLabel, icon: <SunIcon /> },
        { value: 'dark' as const, label: darkLabel, icon: <MoonIcon /> }
      ] satisfies { value: Theme; label: string; icon: ReactNode }[],
    [showSystem, systemLabel, lightLabel, darkLabel]
  );

  /**
   * The trigger fires on the CHANGE, not on the render that shows it.
   *
   * Which is why it is watched here rather than raised inside the click handlers: this control is not the only
   * thing that can move the theme — a second toggle on the page, or the visitor's own machine — and a page that
   * reacts to the scheme wants to hear about all of it. The first pass only records where the theme started.
   */
  const previousTheme = useRef<Theme | null>(null);
  useEffect(() => {
    const previous = previousTheme.current;
    previousTheme.current = theme;
    if (previous === null || previous === theme) {
      return;
    }

    void interactionsManager.interactionTrigger(idRef, 'onThemeChange', { theme });
  }, [theme, interactionsManager, idRef]);

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onThemeChange: {
        action: 'onThemeChange',
        title: 'On Theme Change',
        type: 'trigger',
        params: {},
        preview: { theme: 'dark' }
      }
    }),
    []
  );

  if (subType === 'segmented') {
    return (
      <RootElement
        ref={ref}
        tag="div"
        className={clsx('plitzi-component__theme-toggle plitzi-component__theme-toggle--segmented', className)}
        interactionTriggers={interactionTriggers}
      >
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className={clsx('plitzi-component__theme-toggle-option', styleSelectors.option)}
            // Written only once the browser is rendering: during hydration nothing may depend on stored state.
            data-active={isMounted && theme === option.value ? 'true' : undefined}
            data-theme-option={option.value}
            onClick={choose(option.value)}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </RootElement>
    );
  }

  return (
    <RootElement
      ref={ref}
      tag="button"
      className={clsx('plitzi-component__theme-toggle plitzi-component__theme-toggle--switch', className)}
      interactionTriggers={interactionTriggers}
      type="button"
      onClick={handleToggle}
      aria-label={`${lightLabel} / ${darkLabel}`}
      title={`${lightLabel} / ${darkLabel}`}
    >
      {/*
        Both icons, always, each marked with the scheme it belongs to. WHICH one is on screen is left to the
        space's own stylesheet, and deliberately: it is the same question the palette answers, and answering it
        twice — once here in colours nobody chose, once there — is how a control ends up looking foreign on every
        site that uses it. `data-theme-icon` is what a rule keys off.
      */}
      <span className={clsx('plitzi-component__theme-toggle-icon', styleSelectors.icon)} data-theme-icon="light">
        <SunIcon />
      </span>
      <span className={clsx('plitzi-component__theme-toggle-icon', styleSelectors.icon)} data-theme-icon="dark">
        <MoonIcon />
      </span>
    </RootElement>
  );
};

export default withElement(ThemeToggle);

export { ThemeToggle };
