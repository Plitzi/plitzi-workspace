/* eslint-disable react-refresh/only-export-components -- the hook, its provider and its context are one public module (`@plitzi/sdk-shared/hooks`) */
import { use } from 'react';

import { sharedContext } from '../react/sharedContext';

import type { ReactNode, RefObject } from 'react';

/**
 * What the host rendering a space — the builder, the SDK, a shadow-rooted widget — tells every element: whether it is
 * being edited or looked at, the window it paints in and the root it hangs from. Only what the host alone knows: a
 * context of another package is imported from that package, never carried here.
 *
 * Only what holds for the life of the page. Every element reads this context, so a value that changes here draws every
 * element again: it carried whether the page was still hydrating and its scheme, and the end of hydration drew a whole
 * landing page a second time in one task. Those are read where they live — `useRenderSettings().isHydrating`,
 * `useTheme().resolvedTheme` — by the elements that need them.
 */
export type PlitziContextValue = {
  settings: {
    previewMode?: boolean;
    environment?: string;
    [key: string]: unknown;
  };
  root: { baseElementId: string };
  utils: {
    getWindow: () => Window | null;
    rootRef: RefObject<HTMLElement | null>;
  };
};

const plitziContextDefaultValue = {} as PlitziContextValue;

const PlitziContext = sharedContext<PlitziContextValue>('PlitziContext', plitziContextDefaultValue);

const usePlitzi = () => {
  const context = use(PlitziContext) as PlitziContextValue | undefined;
  if (context === undefined) {
    throw new Error('The Plitzi context is undefined. Render the element inside a PlitziProvider.');
  }

  return context;
};

const PlitziProvider = (props: { children?: ReactNode; value: PlitziContextValue }) => {
  const { children, value } = props;

  return <PlitziContext value={value}>{children}</PlitziContext>;
};

export { PlitziProvider, PlitziContext };

export default usePlitzi;
