// Packages
import React, { useContext, useMemo } from 'react';
import { ComponentContext } from '@plitzi/plitzi-sdk';
import PropTypes from 'prop-types';

// Alias
import AppContext from '@pmodules/App/AppContext';
import BuilderStyleContext from '@pmodules/Builder/contexts/BuilderStyleContext';
import BuilderSchemaContext from '@pmodules/Builder/contexts/BuilderSchemaContext';

// Relatives
import StyleInspectorContext from './StyleInspectorContext';
import { calculateBindings, calculateInheriting } from '../StyleHelper';

const StyleInspectorProvider = props => {
  const { children, selector = '', styleSelector = 'base', element } = props;
  const { displayMode } = useContext(AppContext);
  const { componentDefinitions } = useContext(ComponentContext);
  const {
    schema: { flat }
  } = useContext(BuilderSchemaContext);
  const {
    style: { platform }
  } = useContext(BuilderStyleContext);

  const bindingData = useMemo(() => calculateBindings(element), [element]);

  const inheritData = useMemo(
    () => calculateInheriting(element, flat, platform, displayMode, styleSelector, componentDefinitions),
    [element, flat, displayMode, styleSelector, componentDefinitions]
  );

  const inspectorContextValue = useMemo(
    () => ({ inheritData, bindingData, selector, styleSelector, element }),
    [inheritData, bindingData, selector, styleSelector, element]
  );

  return <StyleInspectorContext.Provider value={inspectorContextValue}>{children}</StyleInspectorContext.Provider>;
};

StyleInspectorProvider.propTypes = {
  children: PropTypes.node,
  selector: PropTypes.string,
  styleSelector: PropTypes.string,
  inheritData: PropTypes.object,
  element: PropTypes.object
};

export default StyleInspectorProvider;
