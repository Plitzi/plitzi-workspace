import { useSyncExternalStore } from 'react';

import { RootElement } from '@plitzi/plitzi-sdk';

import './FullscreenToggle.css';

import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';

export type FullscreenToggleProps = {
  /** Its accessible name while the page is not full screen — the title a pointer shows and a screen reader reads. */
  label?: string;
  /** Its accessible name while it is. */
  exitLabel?: string;
  className?: string;
};

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

/** Four corners pointing out, and the same four pointing in. */
const ENTER_ICON = 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5';
const EXIT_ICON = 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5';

const subscribe = (onChange: () => void): (() => void) => {
  document.addEventListener('fullscreenchange', onChange);

  return () => document.removeEventListener('fullscreenchange', onChange);
};

const isFullscreen = (): boolean => document.fullscreenElement !== null;
// `fullscreenEnabled` is missing altogether on an iPhone, where no element can go full screen.
const canFullscreen = (): boolean => 'fullscreenEnabled' in document && document.fullscreenEnabled;
// The server renders the button as a browser that can use it will: it is only taken away once the page knows.
const onServer = { active: (): boolean => false, supported: (): boolean => true };

const toggle = (): void => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();

    return;
  }

  // Refused inside a frame that does not allow it: the page simply stays as it was, which is all there is to do.
  document.documentElement.requestFullscreen().catch(() => undefined);
};

const CALLBACKS: Record<string, InteractionCallback> = {
  toggle: { ...declaration.callbacks.toggle, callback: toggle }
};

/**
 * Full screen, from a click.
 *
 * It reads the document's own state rather than keeping one, so Escape — the browser's way out — is reflected as
 * much as the button's.
 */
const FullscreenToggle = ({
  label = 'Full screen',
  exitLabel = 'Exit full screen',
  className
}: FullscreenToggleProps) => {
  const active = useSyncExternalStore(subscribe, isFullscreen, onServer.active);
  const supported = useSyncExternalStore(subscribe, canFullscreen, onServer.supported);
  if (!supported) {
    return null;
  }

  const name = active ? exitLabel : label;

  return (
    <RootElement
      tag="button"
      type="button"
      className={className}
      title={name}
      aria-label={name}
      aria-pressed={active}
      onClick={toggle}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={CALLBACKS}
    >
      <svg className="fullscreenToggle__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d={active ? EXIT_ICON : ENTER_ICON} />
      </svg>
    </RootElement>
  );
};

export default FullscreenToggle;
