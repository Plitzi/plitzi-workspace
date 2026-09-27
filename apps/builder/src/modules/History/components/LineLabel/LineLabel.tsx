import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';

import { ACTION_ICON, ACTION_TONE } from '../../helpers';

import type { ChangeLine } from '@plitzi/sdk-shared/history';

export type LineLabelProps = { line: ChangeLine };

/** A line's icon and words: what was done is read from the icon, what it was done to from the words. */
const LineLabel = ({ line }: LineLabelProps) => (
  <span className="flex min-w-0 items-baseline gap-1.5 text-xs leading-5">
    <Icon
      icon={ACTION_ICON[line.action]}
      intent="custom"
      className={clsx('w-3 shrink-0 text-center text-[10px]', ACTION_TONE[line.action])}
    />
    <span className="min-w-0 break-words">{line.text}</span>
  </span>
);

export default LineLabel;
