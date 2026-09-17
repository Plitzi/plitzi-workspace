import Select2 from '@plitzi/plitzi-ui/Select2';
import { use, useCallback, useMemo } from 'react';

import ParamElementChip from './ParamElementChip';
import { pickableOptions, pickedElements, toIdList } from '../helpers/elementOptions';
import WorkflowContext from '../WorkflowContext';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ElementInteraction } from '@plitzi/sdk-shared';

export type ParamElementsProps = {
  id: keyof ElementInteraction;
  label: string;
  value?: unknown;
  /** Only elements of this type are offered; every element without one. */
  elementType?: string;
  onChange?: (id: keyof ElementInteraction, value: string[]) => void;
};

/** Several elements of the space, picked one at a time and stored as their ids. */
const ParamElements = ({ id, label, value, elementType, onChange }: ParamElementsProps) => {
  const { elements } = use(WorkflowContext);
  const ids = useMemo(() => toIdList(value), [value]);
  const picked = useMemo(() => pickedElements(ids, elements), [ids, elements]);
  const options = useMemo(() => pickableOptions(elements, elementType, ids), [elements, elementType, ids]);

  const handleAdd = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      if (option?.value) {
        onChange?.(id, [...ids, option.value]);
      }
    },
    [id, ids, onChange]
  );

  const handleRemove = useCallback(
    (removed: string) =>
      onChange?.(
        id,
        ids.filter(current => current !== removed)
      ),
    [id, ids, onChange]
  );

  return (
    <div className="flex w-full flex-col gap-1">
      <Select2
        size="xs"
        label={label}
        placeholder={options.length > 0 ? 'Add…' : 'Nothing else to add'}
        value=""
        options={options}
        disabled={options.length === 0}
        onChange={handleAdd}
      />
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {picked.map(element => (
            <ParamElementChip key={element.id} element={element} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ParamElements;
