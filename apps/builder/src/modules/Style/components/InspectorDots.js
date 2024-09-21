// Packages
import React from 'react';

// Relatives
import useInspectorValues from '../StyleInspector/hooks/useInspectorValues';

const styleKeysDefault = [];

/**
 * @param {{
 *   styleKeys?: string[];
 * }} props
 * @returns {React.ReactElement}
 */
const InspectorDots = props => {
  const { styleKeys = styleKeysDefault } = props;
  const { hasInherit, hasBinding, hasVariables, hasValues } = useInspectorValues({ keys: styleKeys });

  return (
    <div className="flex items-center gap-1.5">
      {hasInherit && <div className="h-1.5 w-1.5 rounded-full bg-orange-300" title="Has Inherit" />}
      {hasValues && <div className="h-1.5 w-1.5 rounded-full bg-blue-300" title="Has Value" />}
      {hasBinding && <div className="h-1.5 w-1.5 rounded-full bg-purple-300" title="Has Binding" />}
      {hasVariables && <div className="h-1.5 w-1.5 rounded-full bg-green-300" title="Has Variables" />}
    </div>
  );
};

export default InspectorDots;
