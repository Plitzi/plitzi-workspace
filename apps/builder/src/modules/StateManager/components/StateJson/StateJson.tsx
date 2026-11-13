import Button from '@plitzi/plitzi-ui/Button';
import CodeMirror from '@plitzi/plitzi-ui/CodeMirror';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { useCallback, useState } from 'react';

import { useTheme } from '@plitzi/sdk-shared/theme/react';

export type StateJsonProps = {
  state: Record<string, unknown>;
  onApply: (state: Record<string, unknown>) => void;
};

/** The whole state as JSON, to paste or rewrite at once, applied as a whole. */
const StateJson = ({ state, onApply }: StateJsonProps) => {
  const { resolvedTheme } = useTheme();
  const { addToast } = useToast();
  const [seen, setSeen] = useState(state);
  const [value, setValue] = useState(() => JSON.stringify(state, null, 2));
  // The canvas moved the state on: the text follows it, as the table does.
  if (seen !== state) {
    setSeen(state);
    setValue(JSON.stringify(state, null, 2));
  }

  const handleApply = useCallback(() => {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('not an object');
      }

      // An object whose keys are the state's own, as JSON.parse just read it.
      onApply(parsed as Record<string, unknown>);
    } catch {
      addToast('The state is not a JSON object — fix it and apply it again', {
        appeareance: 'error',
        autoDismiss: true,
        placement: 'top-right'
      });
    }
  }, [value, onApply, addToast]);

  return (
    <div className="flex min-h-0 grow flex-col gap-2">
      <CodeMirror
        className="border-ui-line-strong min-h-0 grow overflow-hidden rounded-md border"
        value={value}
        theme={resolvedTheme}
        size="xs"
        lineWrapping
        mode="json"
        onChange={setValue}
      />
      <Button size="xs" className="self-end" iconPlacement="before" onClick={handleApply}>
        <Button.Icon icon="fa-solid fa-check" />
        Apply
      </Button>
    </div>
  );
};

export default StateJson;
