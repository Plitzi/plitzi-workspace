export type NodeHeaderProps = {
  className?: string;
  duration?: string;
  status?: string;
  type?: string;
  action?: string;
};

const NodeHeader = ({ duration, status, type, action }: NodeHeaderProps) => {
  return (
    <div className="bg-ui-raised grid grid-cols-2 gap-x-3 gap-y-0.5 rounded p-2">
      <div className="flex gap-1.5">
        <span className="text-ui-fg-subtle">Duration</span>
        <span className="text-ui-fg font-mono">{duration}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-ui-fg-subtle">Type</span>
        <span className="text-ui-fg">{type}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-ui-fg-subtle">Status</span>
        <span className="text-ui-fg">{status}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-ui-fg-subtle">Action</span>
        <span className="text-ui-fg">{action}</span>
      </div>
    </div>
  );
};

export default NodeHeader;
