// Packages
import { useContext, useMemo } from 'react';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Monorepo
import { calculateInheriting } from '@plitzi/sdk-style/StyleHelper';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';

const useStyleInherit = props => {
  const { element, selector, styleSelector } = props;
  const { componentDefinitions } = useContext(ComponentContext);
  const { displayMode } = useContext(AppContext);
  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);
  const {
    style: { platform }
  } = useContext(BuilderStyleContext);

  const inheritData = useMemo(() => {
    const selectorsToSkip = [];
    if (!selector.includes(':')) {
      selectorsToSkip.push(selector);
    }

    return calculateInheriting(
      element,
      flat,
      platform,
      displayMode,
      styleSelector,
      componentDefinitions,
      selectorsToSkip
    );
  }, [element, flat, displayMode, styleSelector, selector, componentDefinitions]);

  return inheritData;
};

export default useStyleInherit;
