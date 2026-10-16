import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import type { KeyboardEvent } from 'react';

export type InspectorSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Finds the category that holds a property — by its CSS name, or the category's title — and opens it. */
const InspectorSearch = ({ value, onChange }: InspectorSearchProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Escape empties the search first; only an empty one lets it through to the canvas, which deselects on it.
      if (e.key === 'Escape' && value) {
        e.stopPropagation();
        onChange('');
      }
    },
    [onChange, value]
  );

  return (
    <div className="border-b border-gray-200 px-2 py-1.5 dark:border-zinc-800">
      <Input
        size="xs"
        value={value}
        placeholder="Find a property — gap, radius, shadow…"
        clearable
        aria-label="Find a style property"
        onChange={onChange}
        onKeyDown={handleKeyDown}
      >
        <Input.Icon icon="fa-solid fa-magnifying-glass" />
      </Input>
    </div>
  );
};

export default InspectorSearch;
