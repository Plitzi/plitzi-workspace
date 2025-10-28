import type { MouseEvent } from 'react';

export type ResourceRemoveButtonProps = { onRemove?: (e: MouseEvent) => void };

const ResourceRemoveButton = ({ onRemove }: ResourceRemoveButtonProps) => {
  return (
    <div className="absolute top-0 left-0 hidden h-full w-full items-center justify-center bg-black/40 group-hover:flex">
      <div className="flex aspect-square cursor-pointer items-center justify-center rounded border border-gray-300 bg-white px-1">
        <i className="fas fa-trash-alt text-lg text-red-500 hover:text-red-400" title="Remove" onClick={onRemove} />
      </div>
    </div>
  );
};

export default ResourceRemoveButton;
