// Packages
import { useContext, useMemo } from 'react';
import { ComponentContext } from '@plitzi/plitzi-sdk';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';

// Relatives
import { calculateInheriting } from '../StyleHelper';

const useStyleInherit = props => {
  const { element, styleSelector } = props;
  const { componentDefinitions } = useContext(ComponentContext);
  const { displayMode } = useContext(AppContext);
  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);
  const {
    style: { platform }
  } = useContext(BuilderStyleContext);

  const inheritData = useMemo(
    () => calculateInheriting(element, flat, platform, displayMode, styleSelector, componentDefinitions),
    [element, flat, displayMode, styleSelector, componentDefinitions]
  );

  return inheritData;
};

export default useStyleInherit;
