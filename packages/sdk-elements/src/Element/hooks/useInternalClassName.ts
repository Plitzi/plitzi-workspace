import clsx from 'clsx';
import { useMemo } from 'react';

import { HIDDEN_CLASS } from '@plitzi/sdk-shared/style';

import { isVisible } from '../helpers/isVisible';
import { useLayoutBody } from '../LayoutBody';

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
  // A component's slot with nothing in it — the instance fills it with nothing, and it holds nothing of its own — is
  // drawn as hidden on the page; in the builder it stays, the place an author drops into.
  const componentSlot = plitziElementLayout?.type === 'component' && plitziElementLayout.slots.includes(id);
  const body = useLayoutBody(componentSlot ? id : undefined);
  const unfilled = componentSlot && previewMode === true && (items ?? []).length === 0 && body === null;
  const visible = isVisible(elementState.visibility) && !unfilled;

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
