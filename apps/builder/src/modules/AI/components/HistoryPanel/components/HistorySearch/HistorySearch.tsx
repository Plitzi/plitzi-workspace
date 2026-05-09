import { Input } from '@plitzi/plitzi-ui';
import { useCallback, useEffect, useRef } from 'react';

import KeyboardKey from '@pmodules/AI/components/KeyboardKey';

export type HistorySearchProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

const HistorySearch = ({ value, onChange, onClear }: HistorySearchProps) => {
  const searchRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((value: string) => onChange(value), [onChange]);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);

    return () => clearTimeout(t);
  }, []);

  return (
    <div className="shrink-0 px-3 pt-3 pb-2">
      <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
        <Input
          className="w-full"
          ref={searchRef}
          value={value}
          onChange={handleChange}
          placeholder="Search conversations…"
          size="xs"
        >
          <Input.Icon icon="fa-solid fa-magnifying-glass" />
        </Input>
        {value && (
          <button onClick={onClear} className="shrink-0 text-zinc-400 dark:text-zinc-600">
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        )}
        {!value && <KeyboardKey char="K" />}
      </div>
    </div>
  );
};

export default HistorySearch;
