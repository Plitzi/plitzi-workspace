// Packages
import React, { use, useMemo } from 'react';

// Relatives
import StyleInspectorContext from '../StyleInspector/StyleInspectorContext';

const styleKeysDefault = [];

/**
 * @param {{
 *   styleKeys?: string[];
 * }} props
 * @returns {React.ReactElement}
 */
const InspectorDots = props => {
  const { styleKeys = styleKeysDefault } = props;
  const { hasValue, inheritData, bindingData } = use(StyleInspectorContext);

  const hasInherit = useMemo(() => {
    return (
      inheritData &&
      Object.keys(inheritData).filter(key => styleKeys.includes(key) || styleKeys.length === 0).length > 0
    );
  }, [styleKeys, inheritData]);

  const hasBinding = useMemo(() => {
    return (
      bindingData &&
      Object.keys(bindingData).filter(key => styleKeys.includes(key) || styleKeys.length === 0).length > 0
    );
  }, [styleKeys, bindingData]);

  return (
    <div className="flex items-center gap-1.5">
      {hasInherit && <div className="h-1.5 w-1.5 rounded-full bg-orange-300" title="Has Inherit" />}
      {hasValue(styleKeys) && <div className="h-1.5 w-1.5 rounded-full bg-blue-300" title="Has Value" />}
      {hasBinding && <div className="h-1.5 w-1.5 rounded-full bg-purple-300" title="Has Binding" />}
    </div>
  );
};

export default InspectorDots;
