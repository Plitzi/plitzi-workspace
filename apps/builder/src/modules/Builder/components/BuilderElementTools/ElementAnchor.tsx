import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { isAnchor } from '@plitzi/sdk-shared/schema/anchor';

export type ElementAnchorProps = {
  anchor?: string;
  /** `undefined` removes it: the element has no `id` in the DOM. */
  onUpdate?: (key: string, value: string | undefined, isDefinition?: boolean) => void;
};

/**
 * The `id` an element carries in the DOM, so a link to `/page#anchor` lands on it. Saved as soon as what is typed is
 * one; while it is not, the field says why and the element keeps the one it had.
 */
const ElementAnchor = ({ anchor = '', onUpdate }: ElementAnchorProps) => {
  const [draft, setDraft] = useState(anchor);
  const valid = draft === '' || isAnchor(draft);

  const handleChange = useCallback(
    (value: string) => {
      setDraft(value);
      if (value === '' || isAnchor(value)) {
        onUpdate?.('anchor', value || undefined, true);
      }
    },
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-1">
      <Input
        size="xs"
        label="Anchor"
        placeholder="pricing"
        value={draft}
        title="Its id in the page: a link to /page#pricing scrolls here."
        onChange={handleChange}
      />
      {!valid && (
        <span className="text-xs text-red-600 dark:text-red-400">
          Lowercase letters, digits and “-”, starting with a letter.
        </span>
      )}
    </div>
  );
};

export default ElementAnchor;
