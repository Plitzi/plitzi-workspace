import { useSyncExternalStore } from 'react';

// The store the panel is scoped to, picked from the header's scope dropdown. Kept in a module (not React state) so the
// selection survives the panel remounting when the user switches which instance drives it.

let selectedUid: string | undefined;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSelectedUid = (): string | undefined => selectedUid;

export const selectStore = (uid: string | undefined): void => {
  if (selectedUid === uid) {
    return;
  }

  selectedUid = uid;
  emit();
};

export const useSelectedStoreUid = (): string | undefined =>
  useSyncExternalStore(subscribe, getSelectedUid, getSelectedUid);
