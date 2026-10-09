import { useMemo } from 'react';

import type { ChangeEvent } from 'react';

/** What a panel is handed to write an attribute back with — the builder's `onUpdate`. */
export type SettingsUpdate = (key: string, value: string | boolean) => void;

/**
 * A panel's writers, one per kind of control: `text('src')` for a field that hands over its text, `checked('loop')`
 * for a checkbox. Each is the same function on every render while `onUpdate` is.
 */
const useSettingsUpdate = (onUpdate?: SettingsUpdate) =>
  useMemo(
    () => ({
      text: (key: string) => (value: string) => onUpdate?.(key, value),
      checked: (key: string) => (event: ChangeEvent<HTMLInputElement>) => onUpdate?.(key, event.target.checked)
    }),
    [onUpdate]
  );

export default useSettingsUpdate;
