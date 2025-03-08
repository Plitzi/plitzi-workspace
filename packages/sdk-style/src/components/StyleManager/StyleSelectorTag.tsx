import Button from '@plitzi/plitzi-ui/Button';
import classNames from 'classnames';
import { useCallback } from 'react';

import SelectorTag from '../Selector/SelectorItem';

import type { TagType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type StyleSelectorTagProps = {
  id: string;
  label?: string;
  active?: boolean;
  elementsCount?: number;
  type?: TagType;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const StyleSelectorTag = ({
  id,
  label = 'Selector',
  active = false,
  elementsCount = 0,
  type = 'class',
  onSelect,
  onDelete
}: StyleSelectorTagProps) => {
  const handleClickSelect = useCallback(() => onSelect?.(id), [id, onSelect]);

  const handleClickDelete = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (id) {
        onDelete?.(id);
      }
    },
    [id, onDelete]
  );

  return (
    <div
      className={classNames('group-1 flex justify-between items-center border-t border-gray-300 p-1', {
        'hover:bg-gray-200': !active,
        'bg-gray-200': active
      })}
      onClick={handleClickSelect}
    >
      <SelectorTag editable={false} selector={label} type={type} active />
      <div className="flex">
        <div className={classNames('mr-1', { flex: active, 'hidden group-1-hover:flex': !active })}>
          <Button
            intent="custom"
            size="custom"
            className="text-red-400 hover:text-red-500 px-1"
            onClick={handleClickDelete}
          >
            <i className="fas fa-trash" />
          </Button>
        </div>
        {elementsCount > 0 && (
          <div className="flex items-center justify-center rounded-sm bg-blue-400 text-white px-1.5">
            {elementsCount}
          </div>
        )}
      </div>
    </div>
  );
};

export default StyleSelectorTag;
