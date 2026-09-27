import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback } from 'react';

import { WHILE_RUNNING_OPTIONS, storedMode } from '../helpers/whileRunning';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { WhileRunning } from '@plitzi/sdk-shared';

export type NodeWhileRunningProps = {
  whileRunning?: WhileRunning;
  onChange?: (data: { whileRunning: WhileRunning | undefined }) => void;
};

/**
 * What the trigger does when it fires again while its flow is still running — shown on the trigger alone.
 *
 * `skip` is written as nothing: it is what a flow does without the setting, and a document that spells out a default
 * is one that reads as a decision somebody made.
 */
const NodeWhileRunning = ({ whileRunning = 'skip', onChange }: NodeWhileRunningProps) => {
  const handleChange = useCallback(
    (option?: Exclude<Option, OptionGroup>) => onChange?.({ whileRunning: storedMode(option?.value) }),
    [onChange]
  );

  return (
    <div className="flex w-full flex-col border-t-2 border-dotted border-gray-300 px-4 py-2 dark:border-zinc-600">
      <Select2
        size="xs"
        label="While running"
        placeholder="Fired again while this flow runs"
        value={whileRunning}
        onChange={handleChange}
        options={WHILE_RUNNING_OPTIONS}
      />
    </div>
  );
};

export default NodeWhileRunning;
