// Packages
import { use, useMemo } from 'react';

// Monorepo
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import { calculateInheriting } from '@plitzi/sdk-style/StyleHelper';
import BuilderSchemaContext from '@plitzi/sdk-shared/builder/BuilderSchemaContext';
import BuilderStyleContext from '@plitzi/sdk-shared/builder/BuilderStyleContext';

const useStyleInherit = props => {
  const { element, selector, styleSelector } = props;
  const { componentDefinitions } = use(ComponentContext);
  const {
    schema: { flat }
  } = use(BuilderSchemaContext);
  const {
    style: { platform }
  } = use(BuilderStyleContext);

  const inheritData = useMemo(() => {
    const selectorsToSkip = [];
    if (!selector.includes(':')) {
      selectorsToSkip.push(selector);
    }

    return calculateInheriting(element, flat, platform, styleSelector, componentDefinitions, selectorsToSkip);
  }, [element, flat, styleSelector, selector, componentDefinitions]);

  return inheritData;
};

export default useStyleInherit;
