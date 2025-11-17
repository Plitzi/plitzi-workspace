import Button from '@plitzi/plitzi-ui/Button';
import classNames from 'classnames';
import { useCallback } from 'react';

export type NodeActionsProps = {
  className?: string;
  onRemove?: () => void;
};

const NodeActions = ({ className = '', onRemove }: NodeActionsProps) => {
  const handleClickRemove = useCallback(() => onRemove?.(), [onRemove]);

  return (
    <div className={classNames('flex h-full flex-col justify-around', className)}>
      <Button
        intent="custom"
        size="custom"
        className="flex h-7 w-7 items-center text-sm text-red-400 hover:text-red-500"
        onClick={handleClickRemove}
        title="Remove"
      >
        <i className="fas fa-trash-alt" />
      </Button>
    </div>
  );
};

export default NodeActions;
