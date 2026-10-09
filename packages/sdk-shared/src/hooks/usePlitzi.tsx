/* eslint-disable react-refresh/only-export-components */
import { use } from 'react';

import { sharedContext } from '../helpers/sharedContext';

import type { ColorScheme } from '../types';
import type { ReactNode, RefObject } from 'react';

/**
 * What the host rendering a space — the builder, the SDK, a shadow-rooted widget — tells every element: whether it is
 * being edited or looked at, its scheme, whether it is still hydrating, the window it paints in and the root it hangs
 * from. Only what the host alone knows: a context of another package is imported from that package, never carried here.
 */
export type PlitziContextValue = {
  settings: {
    isHydrating?: boolean;
    previewMode?: boolean;
    environment?: string;
    [key: string]: unknown;
    /** Already resolved: an element paints in one of two schemes and has no use for the word `system`. */
    theme: ColorScheme;
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
