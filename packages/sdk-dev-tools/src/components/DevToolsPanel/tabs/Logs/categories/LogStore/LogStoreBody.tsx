export type LogStoreBodyProps = {
  path?: string;
  prev?: unknown;
  next?: unknown;
};

const stringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const LogStoreBody = ({ path, prev, next }: LogStoreBodyProps) => (
  <div className="m-2 flex flex-col gap-3 font-mono text-xs">
    <div className="flex gap-1">
      <span className="font-bold text-gray-500">Path:</span>
      <span className="text-gray-700">{path ?? '(full state)'}</span>
    </div>
    <div className="flex gap-4">
      <div className="flex min-w-0 grow basis-0 flex-col gap-1">
        <span className="font-bold text-red-500">Before</span>
        <pre className="max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs">{stringify(prev)}</pre>
      </div>
      <div className="flex min-w-0 grow basis-0 flex-col gap-1">
        <span className="font-bold text-green-500">After</span>
        <pre className="max-h-40 overflow-auto rounded bg-gray-100 p-2 text-xs">{stringify(next)}</pre>
      </div>
    </div>
  </div>
);

export default LogStoreBody;
