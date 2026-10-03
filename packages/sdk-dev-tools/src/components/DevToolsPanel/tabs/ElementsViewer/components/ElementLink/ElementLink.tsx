import { useCallback } from 'react';

import { useCommonStore } from '@plitzi/sdk-shared/store';

export type ElementLinkProps = {
  id: string;
  onSelect?: (id: string) => void;
};

/** Another element named by a value — a child, the parent, the root — by its label, and selected on a click. */
const ElementLink = ({ id, onSelect }: ElementLinkProps) => {
  const [flat] = useCommonStore('schema.flat');
  const label = Object.hasOwn(flat, id) ? flat[id].definition.label : id;

  const handleClick = useCallback(() => onSelect?.(id), [onSelect, id]);

  return (
    <span className="cursor-pointer text-violet-600 hover:underline dark:text-violet-400" onClick={handleClick}>
      {label}
    </span>
  );
};

export default ElementLink;
