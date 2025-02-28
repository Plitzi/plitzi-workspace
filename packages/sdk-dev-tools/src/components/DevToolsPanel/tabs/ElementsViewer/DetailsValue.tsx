import get from 'lodash/get';
import { useMemo, use, useCallback } from 'react';

import SchemaContext from '@plitzi/sdk-schema/SchemaContext';

import type { ReactNode } from 'react';

export type DetailsValue = {
  attribute?: string;
  value?: unknown;
  isDefinition?: boolean;
  isAttribute?: boolean;
  isStyle?: boolean;
  onSelectElement?: (id: string) => void;
};

const DetailsValue = ({
  attribute,
  value,
  isDefinition = false,
  // isAttribute = false,
  // isStyle = false,
  onSelectElement
}: DetailsValue) => {
  const { schema } = use(SchemaContext);

  const handleClickElement = useCallback((elementId: string) => () => onSelectElement?.(elementId), [onSelectElement]);

  const valueParsed = useMemo<ReactNode>(() => {
    if (attribute === 'items' && isDefinition && Array.isArray(value)) {
      // childrens
      return (
        <div className="flex flex-col">
          {value.map((item: string, i) => (
            <div key={i} className="text-purple-400 cursor-pointer" onClick={handleClickElement(item)}>
              {get(schema, `flat.${item}.definition.label`, item)}
            </div>
          ))}
        </div>
      );
    }

    if (attribute && ['rootId', 'parentId'].includes(attribute) && isDefinition) {
      return (
        <div className="text-purple-400 cursor-pointer" onClick={handleClickElement(value as string)}>
          {get(schema, `flat.${value as string}.definition.label`, value) as string}
        </div>
      );
    }

    if (attribute === 'styleSelectors' && isDefinition && value && typeof value === 'object') {
      return Object.values(value).join(', ');
    }

    if (typeof value === 'object' && value) {
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }

    return value as ReactNode;
  }, [attribute, isDefinition, value, handleClickElement, schema]);

  return <div className="grow basis-0 truncate">{valueParsed}</div>;
};

export default DetailsValue;
