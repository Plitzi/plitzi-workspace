import { useCallback, useEffect, useRef } from 'react';

export type HistorySearchProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

const HistorySearch = ({ value, onChange, onClear }: HistorySearchProps) => {
  const searchRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), [onChange]);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);

    return () => clearTimeout(t);
  }, []);

  return (
    <div className="shrink-0 px-3 pt-3 pb-2">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
        <i className="fa-solid fa-magnifying-glass shrink-0 text-[11px] text-zinc-400 dark:text-zinc-600" />
        <input
          ref={searchRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Search conversations…"
          className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
        />
        {value && (
          <button onClick={onClear} className="shrink-0 text-zinc-400 dark:text-zinc-600">
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        )}
        {!value && (
          <kbd className="shrink-0 rounded border border-b-2 border-neutral-300 bg-neutral-100 px-1 py-px font-mono text-[9px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-600">
            ⌘K
          </kbd>
        )}
      </div>
    </div>
  );
};

export default HistorySearch;
