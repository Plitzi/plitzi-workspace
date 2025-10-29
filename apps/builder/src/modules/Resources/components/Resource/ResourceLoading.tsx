import Icon from '@plitzi/plitzi-ui/Icon';

const ResourceLoading = () => {
  return (
    <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-black/40">
      <div className="flex w-full justify-center p-2">
        <Icon icon="fa-solid fa-sync" intent="custom" className="fa-spin fa-2x text-white" />
      </div>
    </div>
  );
};

export default ResourceLoading;
