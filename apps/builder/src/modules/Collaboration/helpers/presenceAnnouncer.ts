/** How long a collaborator whose socket closed may take to come back before "left" is said. */
export const LEFT_GRACE_MS = 10_000;

export type PresenceAnnouncement = 'joined' | 'left';

/**
 * Which presence changes are worth saying. A collaborator is a builder instance — one tab — and every instance that
 * reconnects announces itself again: a deploy, a server that restarted or a laptop that woke closed every socket at
 * once, and each one that came back was "joined" for people it never left (yourself in another tab, as "admin joined").
 * An instance this builder already knows is never new; one that leaves is said to have left only if it is not back
 * within {@link LEFT_GRACE_MS}, and once said, its return is a join again.
 */
export const createPresenceAnnouncer = <C extends { instanceId: string }>(
  announce: (collaborator: C, announcement: PresenceAnnouncement) => void,
  graceMs = LEFT_GRACE_MS
) => {
  const known = new Set<string>();
  const leaving = new Map<string, ReturnType<typeof setTimeout>>();

  const stay = (instanceId: string) => {
    clearTimeout(leaving.get(instanceId));
    leaving.delete(instanceId);
  };

  return {
    /** The server's snapshot on (re)connecting: who is here, none of it news. */
    present: (collaborators: C[]) => {
      for (const { instanceId } of collaborators) {
        stay(instanceId);
        known.add(instanceId);
      }
    },
    connected: (collaborator: C) => {
      stay(collaborator.instanceId);
      if (known.has(collaborator.instanceId)) {
        return;
      }

      known.add(collaborator.instanceId);
      announce(collaborator, 'joined');
    },
    disconnected: (collaborator: C) => {
      if (!known.has(collaborator.instanceId) || leaving.has(collaborator.instanceId)) {
        return;
      }

      leaving.set(
        collaborator.instanceId,
        setTimeout(() => {
          leaving.delete(collaborator.instanceId);
          known.delete(collaborator.instanceId);
          announce(collaborator, 'left');
        }, graceMs)
      );
    },
    dispose: () => {
      for (const timer of leaving.values()) {
        clearTimeout(timer);
      }

      leaving.clear();
    }
  };
};
