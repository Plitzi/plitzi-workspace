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
      className="hover:bg-ui-hover flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs"
      onClick={handleSelect}
    >
      <span className="bg-ui-raised text-ui-fg shrink-0 rounded-sm px-1 py-0.5 font-mono text-[11px] font-semibold">
        {method}
      </span>
      <code className="text-ui-fg truncate">{path}</code>
    </button>
  );
};

export default RouteItem;
