// Packages
import React, { useMemo, use, useCallback } from 'react';
import classNames from 'classnames';
import get from 'lodash/get';
import noop from 'lodash/noop';

// MOnorepo
import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

/**
 * @param {{
 *   className?: string;
 *   attribute?: string;
 *   value?: any;
 *   isDefinition?: boolean;
 *   isAttribute?: boolean;
 *   isStyle?: boolean;
 *   onSelectElement: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DetailsValue = props => {
  const {
    className,
    attribute,
    value,
    isDefinition = false,
    // isAttribute = false,
    // isStyle = false,
    onSelectElement = noop
  } = props;
  const { schema } = use(SchemaContext);

  const handleClickElement = useCallback(elementId => () => onSelectElement(elementId), [onSelectElement]);

  const valueParsed = useMemo(() => {
    if (attribute === 'items' && isDefinition && value) {
      // childrens
      return (
        <div className="flex flex-col">
          {value.map((item, i) => (
            <div key={i} className="text-purple-400 cursor-pointer" onClick={handleClickElement(item)}>
              {get(schema, `flat.${item}.definition.label`, item)}
            </div>
          ))}
        </div>
      );
    }

    if (['rootId', 'parentId'].includes(attribute) && isDefinition) {
      return (
        <div className="text-purple-400 cursor-pointer" onClick={handleClickElement(value)}>
          {get(schema, `flat.${value}.definition.label`, value)}
        </div>
      );
    }

    if (attribute === 'styleSelectors' && isDefinition) {
      return Object.values(value).join(', ');
    }

    if (typeof value === 'object' && value) {
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }

    return value;
  }, [value, handleClickElement, schema]);

  return <div className={classNames('', className)}>{valueParsed}</div>;
};

export default DetailsValue;
