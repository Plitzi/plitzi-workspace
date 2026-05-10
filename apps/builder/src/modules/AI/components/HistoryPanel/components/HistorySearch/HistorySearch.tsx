import { Input } from '@plitzi/plitzi-ui';
import { useCallback, useEffect, useRef } from 'react';

import KeyboardKey from '@pmodules/AI/components/KeyboardKey';

export type HistorySearchProps = {
  value: string;
  onChange: (value: string) => void;
};

const HistorySearch = ({ value, onChange }: HistorySearchProps) => {
  const searchRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((value: string) => onChange(value), [onChange]);

  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);

    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex items-center gap-3 border-t border-neutral-200 bg-neutral-100 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
      <Input
        className="w-full"
        ref={searchRef}
        value={value}
        onChange={handleChange}
        placeholder="Search conversations…"
        size="xs"
        clearable
      >
        <Input.Icon icon="fa-solid fa-magnifying-glass" />
      </Input>
      <KeyboardKey char="K" />
    </div>
  );
};

export default HistorySearch;
