import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import ViewTabs from '@pmodules/App/components/ViewTabs';
import { fixableCount } from '@pmodules/Space/helpers/spaceIssues';

import IssueGroup from './components/IssueGroup';
import SuggestionGroup from './components/SuggestionGroup';
import { MUTED, SEVERITY_TEXT, SUGGESTION_TEXT } from './helpers';

import type { IssueKind } from './helpers';
import type { TSpaceIssues } from '@plitzi/sdk-shared/network';

export type SpaceIssuesProps = {
  issues: TSpaceIssues;
  /** Said above the list — why it is being shown, when that is not simply because someone asked. */
  intro?: string;
  /** Called once the list has served its purpose — someone went to an element, or had the fixable ones fixed. */
  onDismiss: () => void;
  /** Fixes what has one reading; offered only when something in the list has. */
  onFix?: () => Promise<unknown>;
};

const KINDS: { id: IssueKind; label: string; tone: string }[] = [
  { id: 'errors', label: 'Errors', tone: SEVERITY_TEXT.error },
  { id: 'warnings', label: 'Warnings', tone: SEVERITY_TEXT.warning },
  { id: 'suggestions', label: 'Suggestions', tone: SUGGESTION_TEXT }
];

/** What each list is, in a line under its tab. */
const ABOUT: Record<IssueKind, string> = {
  errors: 'What stops a publish: the space would ship broken.',
  warnings: 'What renders, but most likely not as meant.',
  suggestions:
    'Nothing here is wrong — each is a shorter, lighter or phone-ready way to the same page. Take one unless the copies are about to diverge.'
};

/**
 * Everything the linter found in the saved space, a tab per list — errors first, since they are what stops a publish,
 * then what renders but most likely not as meant, then the shorter ways to the same page — and in each, a group per
 * code. The tabs and the fix stay put; only the list scrolls.
 */
const SpaceIssues = ({ issues, intro, onDismiss, onFix }: SpaceIssuesProps) => {
  const clean = issues.errors.length === 0 && issues.warnings.length === 0;
  const fixable = fixableCount(issues);
  const present = KINDS.filter(kind => issues[kind.id].length > 0);
  const [chosen, setChosen] = useState<IssueKind | undefined>(undefined);
  const selected = present.find(kind => kind.id === chosen)?.id ?? present.at(0)?.id;

  const handleFix = useCallback(() => {
    void onFix?.().then(onDismiss);
  }, [onDismiss, onFix]);

  return (
    <div className="flex max-h-[75vh] min-h-0 flex-col gap-3">
      {intro && <p className="text-sm text-zinc-700 dark:text-zinc-200">{intro}</p>}
      {clean && (
        <p className={clsx('flex items-center gap-2 text-sm', MUTED)}>
          <i className="fa-solid fa-circle-check text-green-600 dark:text-green-400" />
          Nothing wrong with the saved space.
        </p>
      )}
      {(present.length > 0 || (onFix && fixable > 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {present.length > 0 && selected && (
            <ViewTabs
              tabs={present.map(kind => ({
                id: kind.id,
                label: kind.label,
                mark: <span className={clsx('tabular-nums', kind.tone)}>{issues[kind.id].length}</span>
              }))}
              selected={selected}
              onSelect={setChosen}
            />
          )}
          {onFix && fixable > 0 && (
            <Button size="sm" intent="secondary" onClick={handleFix}>
              {`Fix ${String(fixable)} automatically`}
            </Button>
          )}
        </div>
      )}
      {selected && (
        <div className="flex min-h-0 flex-col gap-2" role="tabpanel">
          <p className={clsx('text-[11px] leading-relaxed', MUTED)}>{ABOUT[selected]}</p>
          <div className="min-h-0 overflow-y-auto pr-1">
            {selected === 'errors' && <IssueGroup issues={issues.errors} severity="error" onDismiss={onDismiss} />}
            {selected === 'warnings' && (
              <IssueGroup issues={issues.warnings} severity="warning" onDismiss={onDismiss} />
            )}
            {selected === 'suggestions' && <SuggestionGroup suggestions={issues.suggestions} onDismiss={onDismiss} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpaceIssues;
