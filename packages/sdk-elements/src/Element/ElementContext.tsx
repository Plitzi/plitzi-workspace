import { createContext } from 'react';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';
import type { CSSProperties } from 'react';

export type ElementContextValue<T extends 'skipHOC' | 'full' = 'full'> = {
  /** The one name this element answers to: its key in the schema, the `<type>_<id>` it publishes its data source
   *  under, and the target an interaction wires to. */
  id: string;
  rootId?: string;
  /**
   * Whether this element is on screen: its own `visibility` state AND every ancestor's, chained through this context.
   * A hidden element is hidden in CSS by default, subtree and all, so anything that DOES something rather than just
   * paint — fetching, polling, submitting — reads this instead of its own state to stay inert while the branch it
   * lives in is hidden. An element whose `loadStrategy` unmounts its items is the exception, and it does not change
   * what this means: the ones still mounted must still go quiet.
   */
  visible: boolean;
  /**
   * This INSTANCE, for tracing — and only for tracing.
   *
   * `id` names the element; a controlled list renders that same element once per row, and the render tree the
   * dev-tools draw has to tell those rows apart or it collapses them into one. React's own identity is per mounted
   * component, so this comes from `useId` and is what `withElement` labels its `Profiler` with and links parents by.
   *
   * Nothing that is not the tracing panel should read it: it is an opaque handle with no meaning in the schema.
   */
  traceId: string;
} & (T extends 'skipHOC'
  ? { plitziJsxSkipHOC: true }
  : {
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
    });

const ElementContext = createContext<ElementContextValue | ElementContextValue<'skipHOC'>>(
  undefined as unknown as ElementContextValue
);
ElementContext.displayName = 'ElementContext';

export default ElementContext;
