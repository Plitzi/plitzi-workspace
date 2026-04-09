export type NodeFooterProps = {
  onClickOpen?: () => void;
};

const NodeFooter = ({ onClickOpen }: NodeFooterProps) => {
  return (
    <div className="flex cursor-pointer items-center border-t-2 border-dotted border-gray-300 p-2 dark:border-zinc-600">
      <div className="flex grow basis-0 items-center justify-center" onClick={onClickOpen}>
        <i className="fa-solid fa-arrows-up-to-line mr-2" />
        <div>Close</div>
      </div>
    </div>
  );
};

export default NodeFooter;
