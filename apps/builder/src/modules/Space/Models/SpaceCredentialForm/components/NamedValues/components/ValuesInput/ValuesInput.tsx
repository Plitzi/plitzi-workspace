import KVInput from '@plitzi/plitzi-ui/KVInput';
import { useCallback } from 'react';

export type ValuesInputProps = {
  value: Record<string, string>;
  error?: string;
  onChange: (value: Record<string, string>) => void;
};

/** A name and a value per row, kept as the flat record a credential is. */
const ValuesInput = ({ value, error, onChange }: ValuesInputProps) => {
  // The pairs as typed: KVInput's object form nests a dotted name, and a credential's names are flat.
  const handleChange = useCallback((pairs: [string, string][]) => onChange(Object.fromEntries(pairs)), [onChange]);

  return (
    <div className="flex flex-col gap-1">
      <KVInput value={value} label="Values" size="xs" error={error} onChange={handleChange} />
      <span className="text-ui-fg-subtle text-xs">
        A connector or a flow reads each by its name: a value named token is {'{{credential.token}}'}.
      </span>
    </div>
  );
};

export default ValuesInput;
