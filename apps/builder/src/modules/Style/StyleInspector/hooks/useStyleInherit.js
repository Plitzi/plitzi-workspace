// Packages
import { use, useMemo } from 'react';

// Monorepo
import ComponentContext from '@plitzi/sdk-elements/ComponentContext';
import { calculateInheriting } from '@plitzi/sdk-style/StyleHelper';

// Alias
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';

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
