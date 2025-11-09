import classNames from 'classnames';
import get from 'lodash/get.js';
import { useMemo } from 'react';

import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';

export type UseInternalClassNameProps = {
  className?: string;
  internalProps: InternalPropsSTG2;
  previewMode?: boolean;
  baseElementId?: string;
};

const useInternalClassName = ({ className, internalProps, previewMode, baseElementId }: UseInternalClassNameProps) => {
  const { id, plitziElementLayout, definition, elementState } = internalProps;
  const { items } = definition;
  const visibility = useMemo(() => get(elementState, 'visibility'), [elementState]);

  return useMemo(
    () =>
      classNames(className, {
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
