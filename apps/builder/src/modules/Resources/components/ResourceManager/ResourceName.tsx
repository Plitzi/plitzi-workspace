import classNames from 'classnames';

export type ResourceNameProps = {
  name?: string;
  fullWidth?: boolean;
};

const ResourceName = ({ name, fullWidth = false }: ResourceNameProps) => {
  return (
    <div
      className={classNames(
        'absolute right-4 bottom-0 left-0 flex items-center truncate overflow-hidden bg-white p-1 px-2 text-xs',
        { 'w-full': fullWidth, 'max-w-[200px] rounded-tr': !fullWidth }
      )}
    >
      <div className="truncate" title={name}>
        {name}
      </div>
    </div>
  );
};

export default ResourceName;
