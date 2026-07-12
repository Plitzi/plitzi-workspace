import { useEffect, useSyncExternalStore } from 'react';

// Several SDK instances can mount on the same page, each wrapping its subtree in a `DevToolsContainer`. They all share
// the process-wide `pConsole`, so only ONE panel may exist. This module elects which instance renders it: every enabled
// container registers its `instanceId`, and the panel's header exposes a dropdown to pick the active one. Because the
// panel is then rendered inside the SELECTED instance's provider tree, every context-driven tab (Store, Elements,
// Variables, Plugins, Navigation) reflects that instance automatically.

const instanceIds: string[] = [];
const listeners = new Set<() => void>();
let selectedId: string | undefined;

// Stable array reference between mutations so `useSyncExternalStore` doesn't loop (identity only changes on add/remove).
let snapshot: ReadonlyArray<string> = [];

const emit = () => {
  snapshot = [...instanceIds];
  for (const listener of listeners) {
    listener();
  }
};

const registerInstance = (instanceId: string): (() => void) => {
  instanceIds.push(instanceId);
  // The first instance to register drives the panel until the user picks another (or it unmounts).
  if (selectedId === undefined) {
    selectedId = instanceId;
  }

  emit();

  return () => {
    const index = instanceIds.indexOf(instanceId);
    if (index !== -1) {
      instanceIds.splice(index, 1);
    }

    if (selectedId === instanceId) {
      selectedId = instanceIds[0];
    }

    emit();
  };
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getInstancesSnapshot = (): ReadonlyArray<string> => snapshot;
const getSelectedId = (): string | undefined => selectedId;

export const selectInstance = (instanceId: string): void => {
  if (selectedId === instanceId) {
    return;
  }

  selectedId = instanceId;
  emit();
};

// Registers this instance and reports whether it is the one selected to render the panel.
export const useIsSelectedInstance = (instanceId: string, enabled: boolean): boolean => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    return registerInstance(instanceId);
  }, [enabled, instanceId]);

  const selected = useSyncExternalStore(subscribe, getSelectedId, getSelectedId);

  return enabled && selected === instanceId;
};

// The live list of registered instances plus the current selection, for the header dropdown.
export const useDevInstances = (): { instanceIds: ReadonlyArray<string>; selectedId: string | undefined } => {
  const ids = useSyncExternalStore(subscribe, getInstancesSnapshot, getInstancesSnapshot);
  const selected = useSyncExternalStore(subscribe, getSelectedId, getSelectedId);

  return { instanceIds: ids, selectedId: selected };
};
