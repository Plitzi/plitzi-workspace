import { useEffect } from 'react';

import type { RefObject } from 'react';

/**
 * A field that takes the focus each time it is shown: as it mounts, and again whenever it — or anything it is in — goes
 * from hidden to shown. The native `autofocus` only acts on insertion, and a panel that hides keeps its field mounted.
 */
const useFocusWhenShown = (ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>, shown: boolean): void => {
  useEffect(() => {
    if (shown) {
      ref.current?.focus();
    }
  }, [ref, shown]);
};

export default useFocusWhenShown;
