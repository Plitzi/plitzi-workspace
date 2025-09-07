export type NodeHeaderProps = {
  className?: string;
  duration?: string;
  status?: string;
  type?: string;
  action?: string;
};

const NodeHeader = ({ duration, status, type, action }: NodeHeaderProps) => (
  <div className="flex flex-col justify-between gap-1">
    <div className="flex w-full gap-1">
      <div className="flex grow basis-0 gap-1">
        <div className="font-bold">Duration:</div>
        {duration}
      </div>
      <div className="flex grow basis-0 gap-1">
        <div className="font-bold">Type:</div>
        {type}
      </div>
    </div>
    <div className="flex w-full gap-1">
      <div className="flex grow basis-0 gap-1">
        <div className="font-bold">Status:</div>
        {status}
      </div>
      <div className="flex grow basis-0 gap-1">
        <div className="font-bold">Action:</div>
        {action}
      </div>
    </div>
  </div>
);

export default NodeHeader;
