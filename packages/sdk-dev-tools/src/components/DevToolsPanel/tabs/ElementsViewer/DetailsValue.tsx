import { get } from '@plitzi/plitzi-ui/helpers';
import { useMemo, useCallback } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

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
  const [flat] = useCommonStore('schema.flat');

  const handleClickElement = useCallback((elementId: string) => () => onSelectElement?.(elementId), [onSelectElement]);

  const valueParsed = useMemo<ReactNode>(() => {
    if (attribute === 'items' && isDefinition && Array.isArray(value)) {
      // childrens
      return (
        <div className="flex flex-col">
          {value.map((item: string, i) => (
            <div key={i} className="cursor-pointer text-purple-400" onClick={handleClickElement(item)}>
              {get(flat, `${item}.definition.label`, item)}
            </div>
          ))}
        </div>
      );
    }

    if (attribute && ['rootId', 'parentId'].includes(attribute) && isDefinition) {
      return (
        <div className="cursor-pointer text-purple-400" onClick={handleClickElement(value as string)}>
          {get(flat, `${value as string}.definition.label`, value) as string}
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
  }, [attribute, isDefinition, value, handleClickElement, flat]);

  return <div className="grow basis-0 truncate">{valueParsed}</div>;
};

export default DetailsValue;
