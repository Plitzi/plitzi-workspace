export type ToolActivityProps = {
  tools: string[];
};

const ToolActivity = ({ tools }: ToolActivityProps) => (
  <div className="flex flex-col gap-1">
    {tools.map(name => (
      <div key={name} className="flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        {name}
      </div>
    ))}
  </div>
);

export default ToolActivity;
