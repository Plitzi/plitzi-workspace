import classNames from 'classnames';
import { useCallback } from 'react';

export type ElementsListItemProps = {
  id?: string;
  name?: string;
  isSelected?: boolean;
  isVisible?: boolean;
  elementSelected?: string;
  onSelect?: (id?: string) => void;
};

const ElementsListItem = ({ name, id, isSelected, isVisible = true, onSelect }: ElementsListItemProps) => {
  const handleClickElement = useCallback(() => onSelect?.(id), [onSelect, id]);

  return (
    <div
      className={classNames(
        'flex w-full cursor-pointer items-center justify-between gap-4 rounded-sm border border-gray-300 px-2 py-1',
        { 'bg-purple-300': isSelected, 'hover:bg-purple-200': !isSelected }
      )}
      onClick={handleClickElement}
    >
      <div className="truncate" title={name}>
        {name}
      </div>
      <i className={classNames('fa-solid fa-eye-slash', { 'fa-eye': isVisible, 'fa-eye-slash': !isVisible })} />
    </div>
  );
};

export default ElementsListItem;
