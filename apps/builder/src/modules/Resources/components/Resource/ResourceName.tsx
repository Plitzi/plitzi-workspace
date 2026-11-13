export type ResourceNameProps = {
  name?: string;
  fullWidth?: boolean;
};

const ResourceName = ({ name }: ResourceNameProps) => {
  return (
    <div className="bg-ui-raised dark:text-ui-fg-muted flex w-full items-center truncate overflow-hidden px-2 text-xs">
      <div className="truncate" title={name}>
        {name}
      </div>
    </div>
  );
};

export default ResourceName;
