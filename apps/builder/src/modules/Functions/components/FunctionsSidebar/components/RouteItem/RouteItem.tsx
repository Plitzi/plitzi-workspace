import { useCallback } from 'react';

export type RouteItemProps = {
  routeKey: string;
  method: string;
  path: string;
  onSelect: (route: string) => void;
};

/** One route: the method and the address it answers at, a click from where it is written. */
const RouteItem = ({ routeKey, method, path, onSelect }: RouteItemProps) => {
  const handleSelect = useCallback(() => onSelect(routeKey), [onSelect, routeKey]);

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-zinc-800"
      onClick={handleSelect}
    >
      <span className="shrink-0 rounded-sm bg-gray-100 px-1 py-0.5 font-mono text-[11px] font-semibold text-gray-700 dark:bg-zinc-800 dark:text-zinc-200">
        {method}
      </span>
      <code className="truncate text-gray-700 dark:text-zinc-300">{path}</code>
    </button>
  );
};

export default RouteItem;
