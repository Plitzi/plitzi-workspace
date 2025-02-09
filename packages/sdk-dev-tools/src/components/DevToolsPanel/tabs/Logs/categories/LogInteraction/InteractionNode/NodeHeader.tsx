export type NodeHeaderProps = {
  className?: string;
  duration?: string;
  status?: string;
  type?: string;
  action?: string;
};

const NodeHeader = ({ duration, status, type, action }: NodeHeaderProps) => (
  <div className="flex flex-col gap-1 justify-between">
    <div className="flex gap-1 w-full">
      <div className="flex gap-1 grow basis-0">
        <div className="font-bold">Duration:</div>
        {duration}
      </div>
      <div className="flex gap-1 grow basis-0">
        <div className="font-bold">Type:</div>
        {type}
      </div>
    </div>
    <div className="flex gap-1 w-full">
      <div className="flex gap-1 grow basis-0">
        <div className="font-bold">Status:</div>
        {status}
      </div>
      <div className="flex gap-1 grow basis-0">
        <div className="font-bold">Action:</div>
        {action}
      </div>
    </div>
  </div>
);

export default NodeHeader;
