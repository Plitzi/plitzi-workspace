export type NodeHeaderProps = {
  className?: string;
  duration?: string;
  status?: string;
  type?: string;
  action?: string;
};

const NodeHeader = ({ duration, status, type, action }: NodeHeaderProps) => {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded bg-zinc-50 p-2 dark:bg-zinc-800/60">
      <div className="flex gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">Duration</span>
        <span className="font-mono text-zinc-700 dark:text-zinc-300">{duration}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">Type</span>
        <span className="text-zinc-700 dark:text-zinc-300">{type}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">Status</span>
        <span className="text-zinc-700 dark:text-zinc-300">{status}</span>
      </div>
      <div className="flex gap-1.5">
        <span className="text-zinc-400 dark:text-zinc-500">Action</span>
        <span className="text-zinc-700 dark:text-zinc-300">{action}</span>
      </div>
    </div>
  );
};

export default NodeHeader;
