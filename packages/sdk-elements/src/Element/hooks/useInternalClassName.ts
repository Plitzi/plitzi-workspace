import clsx from 'clsx';
import { useMemo } from 'react';

import { HIDDEN_CLASS } from '@plitzi/sdk-shared/style/styleStates';

import { isVisible } from '../helpers/isVisible';

import type { Element, ElementLayout } from '@plitzi/sdk-shared';

export type UseInternalClassNameProps = {
  className?: string;
  previewMode?: boolean;
  baseElementId?: string;
  id: string;
  elementState: Record<string, unknown>;
  definition: Element['definition'];
  plitziElementLayout?: ElementLayout;
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
  const visible = isVisible(elementState.visibility);

  return useMemo(
    () =>
      clsx(
        className,
        {
          [HIDDEN_CLASS]: !visible,
          'plitzi-component': !previewMode && !plitziElementLayout,
          'plitzi-component--layout': !previewMode && !!plitziElementLayout,
          with__container: !previewMode && !!items,
          'container--empty': !previewMode && !!items && items.length === 0 && !plitziElementLayout,
          'container--base-element': !previewMode && !!items && baseElementId === id,
          'plitzi-component--layout-body': plitziElementLayout?.slots.includes(id)
        },
        definition.styleSelectors.base
      ),
    [className, visible, previewMode, plitziElementLayout, items, baseElementId, id, definition.styleSelectors.base]
  );
};

export default useInternalClassName;
