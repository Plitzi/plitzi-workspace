import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { WhileRunning } from '@plitzi/sdk-shared';

/** The three answers to "fired again while this flow runs", as the trigger's panel offers them. */
export const WHILE_RUNNING_OPTIONS: (Exclude<Option, OptionGroup> & { value: WhileRunning })[] = [
  { value: 'skip', label: 'Ignore the new one (no double submit)' },
  { value: 'queue', label: 'Queue it: run after, in order' },
  { value: 'parallel', label: 'Run it at the same time' }
];

const isMode = (value: string | undefined): value is WhileRunning =>
  WHILE_RUNNING_OPTIONS.some(option => option.value === value);

/** What a choice is stored as: the mode, or nothing for `skip` — the default, which a document need not spell out. */
export const storedMode = (value: string | undefined): WhileRunning | undefined =>
  isMode(value) && value !== 'skip' ? value : undefined;
