import Button from '@plitzi/plitzi-ui/Button';
import classNames from 'classnames';
import { useCallback, memo } from 'react';

import SelectorItem from '../Selector/SelectorItem';

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
      className={classNames('group flex items-center justify-between gap-2 border-t border-gray-300 p-1', {
        'hover:bg-gray-200': !active,
        'bg-gray-200': active
      })}
      onClick={handleClickSelect}
    >
      <SelectorItem editable={false} selector={label} type={type} active />
      <div className="flex">
        <div className={classNames('mr-1', { flex: active, 'hidden group-hover:flex': !active })}>
          <Button intent="danger" size="xs" onClick={handleClickDelete}>
            <Button.Icon icon="fas fa-trash" />
          </Button>
        </div>
        {elementsCount > 0 && (
          <div className="bg-secondary-400 flex min-w-8 items-center justify-center rounded-sm px-1.5 text-white">
            {elementsCount}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(StyleSelectorTag);
