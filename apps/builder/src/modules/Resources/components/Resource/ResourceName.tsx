export type ResourceNameProps = {
  name?: string;
  fullWidth?: boolean;
};

const ResourceName = ({ name }: ResourceNameProps) => {
  return (
    <div className="flex w-full items-center truncate overflow-hidden bg-white px-2 text-xs dark:bg-zinc-800 dark:text-zinc-300">
      <div className="truncate" title={name}>
        {name}
      </div>
    </div>
  );
};

export default ResourceName;
