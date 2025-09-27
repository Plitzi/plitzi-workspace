export type ResourceNameProps = {
  name?: string;
};

const ResourceName = ({ name }: ResourceNameProps) => {
  return (
    <div className="absolute right-8 bottom-0 left-0 flex max-w-[200px] items-center truncate overflow-hidden rounded-tr bg-gray-300 p-1 px-2 text-xs">
      <div className="truncate" title={name}>
        {name}
      </div>
    </div>
  );
};

export default ResourceName;
