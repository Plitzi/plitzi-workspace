import { useCallback, useState } from 'react';

import { copyText, NOT_COPIED_REASON } from '@plitzi/sdk-shared/helpers/clipboard';

import type { MatchedRule } from '../../../../qa/inspect/rules';

export type QaRuleItemProps = { rule: MatchedRule };

/** How long "Copied" — or "Not copied" — stays after a rule is copied. */
const COPIED_MS = 1200;

const LABELS = { idle: 'Copy', copied: 'Copied', refused: 'Not copied' } as const;

/** A rule that reaches the element, as written: its selector, its media query, its declarations — and a copy of it. */
const QaRuleItem = ({ rule: { selector, declarations, media } }: QaRuleItemProps) => {
  const [copy, setCopy] = useState<keyof typeof LABELS>('idle');

  const handleCopy = useCallback(() => {
    void copyText(`${selector} { ${declarations} }`).then(copied => {
      setCopy(copied ? 'copied' : 'refused');
      setTimeout(() => setCopy('idle'), COPIED_MS);
    });
  }, [selector, declarations]);

  return (
    <div className="group border-b border-zinc-100 px-2.5 py-1.5 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-mono text-violet-700 dark:text-violet-300" title={selector}>
          {selector}
        </span>
        {media && (
          <span className="shrink-0 font-mono text-[10px] text-amber-600 dark:text-amber-400">@media {media}</span>
        )}
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1 text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          onClick={handleCopy}
          title={copy === 'refused' ? NOT_COPIED_REASON : undefined}
        >
          {LABELS[copy]}
        </button>
      </div>
      <div className="mt-0.5 font-mono text-[11px] leading-relaxed break-words text-zinc-600 dark:text-zinc-400">
        {declarations}
      </div>
    </div>
  );
};

export default QaRuleItem;
