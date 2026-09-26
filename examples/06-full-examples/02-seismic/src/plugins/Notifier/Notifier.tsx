import { use, useCallback, useEffect, useMemo, useState } from 'react';

import { RootElement, useElement, usePlitziServiceContext } from '@plitzi/plitzi-sdk';

import { chime, unlockOnGesture } from './audio';
import declaration from './declaration';

import type { InteractionCallback } from '@plitzi/plitzi-sdk';

export type NotifierProps = {
  /** Its label while the browser has not been asked. */
  enableLabel?: string;
  /** Its label once desktop notifications are allowed. */
  onLabel?: string;
  /** Its label when the person refused them — only the browser's own settings can undo that. */
  blockedLabel?: string;
  className?: string;
};

type Permission = NotificationPermission | 'unsupported';

const TRIGGERS: Record<string, InteractionCallback> = declaration.triggers;

const current = (): Permission => ('Notification' in window ? Notification.permission : 'unsupported');

const flag = (value: unknown): boolean => value === true || value === 'true';

/**
 * A desktop notification, if the person allowed them. The operating system shows it and plays ITS sound — which is
 * the one sound a page nobody has touched is allowed to make. One per event (`tag`), so a refresh that repeats an
 * event does not repeat the alert.
 */
const notify = ({ title, body, silent, tag }: { title?: unknown; body?: unknown; silent?: unknown; tag?: unknown }) => {
  if (current() !== 'granted' || typeof title !== 'string' || !title) {
    return;
  }

  const notification = new Notification(title, {
    body: typeof body === 'string' ? body : '',
    silent: flag(silent),
    ...(typeof tag === 'string' && tag ? { tag } : {})
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
};

const CALLBACKS: Record<string, InteractionCallback> = {
  notify: { ...declaration.callbacks.notify, callback: notify },
  chime: {
    ...declaration.callbacks.chime,
    callback: ({ magnitude }: { magnitude?: unknown }) => chime(Number(magnitude) || 0)
  }
};

/**
 * The permission button, and the actions that alert.
 *
 * Rendered from the first paint as "enable" and corrected once the browser is read: permission is a fact about the
 * browser, which the server rendering the page cannot know.
 */
const Notifier = ({
  enableLabel = 'Enable desktop alerts',
  onLabel = 'Desktop alerts on',
  blockedLabel = 'Alerts blocked by the browser',
  className
}: NotifierProps) => {
  const [permission, setPermission] = useState<Permission>('default');
  const { id } = useElement();
  const {
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use(InteractionsContext);

  // Said, not kept: the space decides what permission looks like — here, a chip lit once alerts are on.
  useEffect(() => {
    if (permission !== 'unsupported') {
      void interactionsManager.interactionTrigger(id, declaration.triggers.onPermission.action, { permission });
    }
  }, [permission, interactionsManager, id]);

  useEffect(() => {
    setPermission(current());
    // The page's own ping stays silent until a gesture; this arms it on the first one.
    const release = unlockOnGesture();
    let status: PermissionStatus | undefined;
    const follow = (): void => setPermission(current());
    // A person can allow or block the site from the browser's own settings while the page is open. Asked only where
    // the browser has the Permissions API at all — an older Safari does not.
    if ('permissions' in navigator) {
      void navigator.permissions
        .query({ name: 'notifications' })
        .then(answer => {
          status = answer;
          status.addEventListener('change', follow);
        })
        .catch(() => undefined);
    }

    return () => {
      release();
      status?.removeEventListener('change', follow);
    };
  }, []);

  const ask = useCallback(() => {
    if (current() !== 'default') {
      return;
    }

    void Notification.requestPermission().then(setPermission);
  }, []);

  const label = useMemo(() => {
    if (permission === 'granted') {
      return onLabel;
    }

    return permission === 'denied' ? blockedLabel : enableLabel;
  }, [permission, onLabel, blockedLabel, enableLabel]);

  if (permission === 'unsupported') {
    return null;
  }

  return (
    <RootElement
      tag="button"
      type="button"
      className={className}
      data-permission={permission}
      aria-disabled={permission !== 'default'}
      title={label}
      onClick={ask}
      interactionTriggers={TRIGGERS}
      interactionCallbacks={CALLBACKS}
    >
      {label}
    </RootElement>
  );
};

export default Notifier;
