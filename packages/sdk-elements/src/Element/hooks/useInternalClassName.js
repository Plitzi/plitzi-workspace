// Packages
import { useMemo } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';

const useInternalClassName = props => {
  const { className, internalProps, previewMode, baseElementId } = props;
  const { id, plitziElementLayout, definition, elementState } = internalProps;
  const { items } = definition;
  const visibility = useMemo(() => get(elementState, 'visibility'), [elementState]);

  return useMemo(
    () =>
      classNames(className, {
        'plitzi-component--hidden': visibility === false || visibility === 'false',
        'plitzi-component': !previewMode && !plitziElementLayout,
        'plitzi-component--layout': !previewMode && plitziElementLayout,
        with__container: !previewMode && !!items,
        'container--empty': !previewMode && !!items && (!items || items.length === 0),
        'container--base-element': !previewMode && !!items && baseElementId === id
      }),
    [className, visibility, previewMode, plitziElementLayout, items, id, baseElementId]
  );
};

export default useInternalClassName;
