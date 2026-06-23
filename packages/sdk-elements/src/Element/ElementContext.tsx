import { createContext } from 'react';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

// Resolved, per-instance element data. Carried by `withElement` through a plain React Context so the value propagates
// top-down with the element's own re-render — a descendant (`useElement`, `RootElement`) reads it without an `id` prop
// and without an external-store subscription that could fire a state update mid-render. Cross-element reads by an
// arbitrary id are not needed here (those go through the schema store), so a single ambient context per element is
// enough. The two entry shapes mirror the two `withElement` paths: full resolution vs the JSX-manager manual-render
// path.
type ElementContextIdentity = {
  id: string;
  rootId?: string;
};

// Manual-render path (JSX manager): only identity is published, no resolution.
export type SkipHocElementContextValue = ElementContextIdentity & {
  plitziJsxSkipHOC: true;
};

// Full-resolution path (`withElement`): identity plus the element's resolved data. `plitziJsxSkipHOC` stays optional
// so `RootElement` can branch on it while reading a full entry; consumers (`useElement`) always see this shape.
export type ElementContextValue = ElementContextIdentity & {
  plitziJsxSkipHOC?: boolean;
  className?: string;
  plitziElementLayout?: ElementLayout;
  attributes: Element['attributes'];
  definition: Element['definition'];
  elementState: Record<string, unknown>;
  style?: CSSProperties;
  setElementState: <S extends Record<string, unknown> = Record<string, unknown>>(
    value?: S | ((prev: S) => S)
  ) => boolean;
};

export type ElementContextEntry = ElementContextValue | SkipHocElementContextValue;

const ElementContext = createContext<ElementContextValue | undefined>(undefined);
ElementContext.displayName = 'ElementContext';

export { ElementContext };
