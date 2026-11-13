import clsx from 'clsx';
import { use, useCallback, useState } from 'react';

import { RUN_REPORT_TEXT_MOST } from '@plitzi/sdk-shared/runs';
import { useTheme } from '@plitzi/sdk-shared/theme/react';

import { reportOf, sendReport } from './reportHelpers';
import { clearRecordedSteps } from './stepRecorder';
import usePointAt from './usePointAt';
import PageContext from '../../../../PageContext';

import type { ChangeEvent } from 'react';

type Sending =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; note: string } | { kind: 'failed'; why: string };

/**
 * A bug the person sees on the preview, handed to the run's lead as it is: they point at the element and say what is
 * wrong; the address, the window, the theme and what they did since the page loaded go with it, and the lead gets the
 * command that plays it again. Nothing of it is sent until they press Send.
 */
const RunReport = () => {
  const { resolvedTheme } = useTheme();
  const pageRef = use(PageContext);
  const { pointing, element, missed, point, forget } = usePointAt();
  const [text, setText] = useState('');
  const [sending, setSending] = useState<Sending>({ kind: 'idle' });

  const handleText = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => setText(event.target.value), []);

  const handleSend = useCallback(async () => {
    setSending({ kind: 'sending' });
    const answer = await sendReport(
      reportOf(text, element, resolvedTheme === 'dark' ? 'dark' : 'light', pageRef.current)
    );
    if ('failed' in answer) {
      setSending({ kind: 'failed', why: answer.failed });

      return;
    }

    clearRecordedSteps();
    setText('');
    forget();
    setSending({ kind: 'sent', note: answer.sent });
  }, [text, element, resolvedTheme, pageRef, forget]);

  const handleSendClick = useCallback(() => void handleSend(), [handleSend]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={point}
          aria-pressed={pointing}
          className={clsx('flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors', {
            'bg-violet-500 text-white': pointing,
            'text-ui-fg-muted hover:bg-ui-hover': !pointing
          })}
        >
          <i className="fa-solid fa-crosshairs" />
          Point at it
        </button>
        {pointing && <span className="text-ui-fg-subtle text-[11px]">Click the element on the page — Esc stops</span>}
        {!pointing && element && (
          <span className="bg-ui-raised flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]">
            {element}
            <button
              type="button"
              onClick={forget}
              title="Point at nothing"
              className="text-ui-fg-subtle hover:text-ui-fg"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </span>
        )}
        {!pointing && missed && (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            That is nothing of the page’s own: point at another, or send it for the page as a whole
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={handleText}
        maxLength={RUN_REPORT_TEXT_MOST}
        rows={2}
        placeholder="What is wrong — sent with where you are, the width and what you did on the page"
        className="border-ui-line bg-ui-raised text-ui-fg placeholder:text-ui-fg-subtle w-full resize-y rounded border px-1.5 py-1 outline-none focus:border-violet-400"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSendClick}
          disabled={text.trim() === '' || sending.kind === 'sending'}
          className="flex h-6 items-center gap-1 rounded bg-violet-500 px-2 text-xs font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          <i className="fa-solid fa-paper-plane" />
          Send to the lead
        </button>
        {sending.kind === 'sent' && (
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{sending.note}</span>
        )}
        {sending.kind === 'failed' && (
          <span className="text-[11px] text-red-600 dark:text-red-400">Not sent: {sending.why}</span>
        )}
      </div>
    </div>
  );
};

export default RunReport;
