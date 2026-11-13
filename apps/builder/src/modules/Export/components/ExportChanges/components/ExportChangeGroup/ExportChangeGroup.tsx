import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { messageParts, repairIcon } from '../../../../helpers/repairs';

import type { CorrectionGroup } from '../../../../helpers/repairs';

export type ExportChangeGroupProps = {
  group: CorrectionGroup;
};

/** One kind of change: a heading that folds it away, and every change of that kind on its own row. */
const ExportChangeGroup = ({ group }: ExportChangeGroupProps) => {
  const [open, setOpen] = useState(true);

  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <section className="border-ui-line border-b last:border-b-0">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="bg-ui-raised text-ui-fg hover:bg-ui-hover sticky top-0 flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-xs font-semibold"
      >
        <i
          className={clsx(
            'fa-solid fa-chevron-right text-ui-fg-subtle w-3 text-center text-[10px] transition-transform',
            open && 'rotate-90'
          )}
        />
        <i className={clsx(repairIcon(group.code), 'text-primary-500 dark:text-primary-300 w-3.5 text-center')} />
        <span className="grow">{group.label}</span>
        <span className="bg-ui-active text-ui-fg-muted rounded-full px-1.5 text-[11px] leading-4 font-medium">
          {group.total}
        </span>
      </button>
      {open && (
        <ul className="divide-ui-line divide-y">
          {group.messages.map(message => (
            <li key={message.text} className="text-ui-fg-muted flex items-baseline gap-3 px-4 py-2 pl-14 text-xs">
              <span className="grow leading-5">
                {messageParts(message.text).map(part => (
                  <span
                    key={part.key}
                    className={clsx(part.code && 'bg-ui-raised text-ui-fg rounded px-1 py-0.5 font-mono text-[11px]')}
                  >
                    {part.text}
                  </span>
                ))}
              </span>
              {message.count > 1 && <span className="text-ui-fg-subtle shrink-0 text-[11px]">×{message.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default ExportChangeGroup;
