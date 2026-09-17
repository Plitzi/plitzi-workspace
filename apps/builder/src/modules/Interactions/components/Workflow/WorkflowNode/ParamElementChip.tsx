import clsx from 'clsx';
import { useCallback } from 'react';

import type { PickedElement } from '../helpers/elementOptions';

export type ParamElementChipProps = {
  element: PickedElement;
  onRemove: (id: string) => void;
};

const ParamElementChip = ({ element, onRemove }: ParamElementChipProps) => {
  const handleRemove = useCallback(() => onRemove(element.id), [element.id, onRemove]);

  return (
    <span
      className={clsx(
        'flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs',
        element.missing
          ? 'border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400'
          : 'border-gray-300 text-gray-700 dark:border-zinc-600 dark:text-zinc-200'
      )}
      title={element.missing ? 'No element has this id any more' : element.label}
    >
      {element.label}
      <button className="cursor-pointer text-gray-400 hover:text-red-500" onClick={handleRemove} title="Remove">
        <i className="fa-solid fa-xmark" />
      </button>
    </span>
  );
};

export default ParamElementChip;
