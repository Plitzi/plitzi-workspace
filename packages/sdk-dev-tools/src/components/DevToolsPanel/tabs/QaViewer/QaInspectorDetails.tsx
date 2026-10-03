import { use, useCallback, useMemo } from 'react';

import QaProperty from './QaProperty';
import QaRuleItem from './QaRuleItem';
import { summarize } from '../../../../qa/inspect/describe';
import { matchedRules } from '../../../../qa/inspect/rules';
import QaContrastBadge from '../../../../qa/overlays/QaContrastBadge';
import QaSwatch from '../../../../qa/overlays/QaSwatch';
import QaContext from '../../../../qa/QaContext';

export type QaInspectorDetailsProps = { element: Element };

/**
 * The kept element, in full: its box, its type, its colours and their contrast, the space's classes on it, and every
 * CSS rule that reaches it as written. Read once per element; the panel draws it anew on "Look again".
 */
const QaInspectorDetails = ({ element }: QaInspectorDetailsProps) => {
  const { setPinned } = use(QaContext);
  const summary = useMemo(() => summarize(element), [element]);
  const rules = useMemo(() => matchedRules(element), [element]);

  const handleScroll = useCallback(() => element.scrollIntoView({ block: 'center', behavior: 'smooth' }), [element]);
  const handleUnpin = useCallback(() => setPinned(undefined), [setPinned]);

  if (!summary) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-mono font-semibold text-violet-700 dark:text-violet-300">
          {summary.name}
        </span>
        <span className="shrink-0 font-mono text-zinc-400">
          {summary.width} × {summary.height}
        </span>
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Scroll the page to it"
          onClick={handleScroll}
        >
          <i className="fa-solid fa-crosshairs" />
        </button>
        <button
          type="button"
          className="shrink-0 rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Let it go"
          onClick={handleUnpin}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 rounded border border-zinc-200 px-2.5 py-1.5 @lg:grid-cols-2 dark:border-zinc-700">
        <QaProperty name="display">
          {summary.display} · {summary.position}
        </QaProperty>
        <QaProperty name="font">{summary.font}</QaProperty>
        <QaProperty name="padding">{summary.padding}</QaProperty>
        <QaProperty name="line / track">
          {summary.lineHeight} · {summary.letterSpacing}
        </QaProperty>
        <QaProperty name="margin">{summary.margin}</QaProperty>
        <QaProperty name="colour">
          <QaSwatch colour={summary.colour} />
        </QaProperty>
        <QaProperty name="border">
          {summary.border} · r {summary.radius}
        </QaProperty>
        <QaProperty name="background">{summary.background && <QaSwatch colour={summary.background} />}</QaProperty>
        <QaProperty name="gap · z">
          {summary.gap || '—'} · {summary.zIndex}
        </QaProperty>
        <QaProperty name="contrast">
          {summary.contrast && <QaContrastBadge ratio={summary.contrast.ratio} needs={summary.contrast.needs} />}
        </QaProperty>
      </div>
      {summary.classes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.classes.map(name => (
            <span key={name} className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
              .{name}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col">
        <span className="mb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          CSS that reaches it · {rules.length}
        </span>
        <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-700">
          {rules.map((rule, index) => (
            <QaRuleItem key={`${rule.selector}-${String(index)}`} rule={rule} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default QaInspectorDetails;
