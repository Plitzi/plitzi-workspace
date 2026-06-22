import { use, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import calculateInheriting from '../../../helpers/calculateInheriting';

import type { BuilderState, Element, StyleState } from '@plitzi/sdk-shared';

export type UseStyleInheritProps = {
  element?: Element;
  componentType?: string;
  componentSubType?: string;
  selector?: string;
  styleSelector?: string;
  styleState?: StyleState;
  styleVariant?: string;
};

const useStyleInherit = ({
  element,
  componentType,
  componentSubType,
  selector,
  styleSelector = 'base',
  styleState,
  styleVariant
}: UseStyleInheritProps) => {
  const { useStore } = createStoreHook<BuilderState>();
  const [[flat, platform]] = useStore(['schema.flat', 'style.platform']);
  const { componentDefinitions } = use(ComponentContext);
  const inheritData = useMemo(() => {
    const selectorsToSkip: string[] = [];
    const selectorsToInclude: string[] = [];
    const selectors = (element?.definition.styleSelectors[styleSelector] ?? '').split(' ');
    if (selector && selectors.length > 1) {
      selectorsToSkip.push(selector);
    }

    return calculateInheriting(element, componentType, flat, platform, componentDefinitions.current, {
      componentSubType,
      styleSelector,
      styleState,
      styleVariant,
      includeSelf: selectors.length > 1,
      skipSelectors: selectorsToSkip,
      addSelectors: selectorsToInclude
    });
  }, [
    element,
    styleSelector,
    selector,
    componentType,
    flat,
    platform,
    componentDefinitions,
    componentSubType,
    styleState,
    styleVariant
  ]);

  return inheritData;
};

export default useStyleInherit;
