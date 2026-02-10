import clsx from 'clsx';
import { useMemo } from 'react';

import type { Element, InternalPropsSTG1 } from '@plitzi/sdk-shared';

export type UseInternalClassNameProps = {
  className?: string;
  previewMode?: boolean;
  baseElementId?: string;
  id: string;
  elementState: Record<string, unknown>;
  definition: Element['definition'];
  plitziElementLayout?: InternalPropsSTG1['plitziElementLayout'];
};

const useInternalClassName = ({
  id,
  className,
  previewMode,
  baseElementId,
  plitziElementLayout,
  definition,
  elementState
}: UseInternalClassNameProps) => {
  const { items } = definition;
  const visibility = elementState.visibility as boolean | string;

  return useMemo(
    () =>
      clsx(className, {
        'plitzi-component--hidden': visibility === false || visibility === 'false',
        'plitzi-component': !previewMode && !plitziElementLayout,
        'plitzi-component--layout': !previewMode && !!plitziElementLayout,
        with__container: !previewMode && !!items,
        'container--empty': !previewMode && !!items && items.length === 0 && !plitziElementLayout,
        'container--base-element': !previewMode && !!items && baseElementId === id,
        'plitzi-component--layout-body': plitziElementLayout && id === plitziElementLayout.containerId
      }),
    [className, visibility, previewMode, plitziElementLayout, items, id, baseElementId]
  );
};

export default useInternalClassName;
