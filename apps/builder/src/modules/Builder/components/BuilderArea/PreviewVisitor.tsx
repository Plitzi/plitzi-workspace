import { use } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import HeaderPopover from '@pmodules/App/components/AppHeader/HeaderPopover';
import PreviewPanel from '@pmodules/StateManager/components/PreviewPanel';
import useCanvasVisitor from '@pmodules/StateManager/hooks/useCanvasVisitor';

import { PreviewDockContext } from './previewDockRoom';

import type { VisitorDevice } from '@plitzi/sdk-shared/audiences';

const DEVICE_ICON: Readonly<Record<VisitorDevice, string>> = {
  mobile: 'fa-solid fa-mobile-screen',
  tablet: 'fa-solid fa-tablet-screen-button',
  desktop: 'fa-solid fa-desktop'
};

/** The instant the preview is read at, when one is chosen: in UTC, as the backend keeps it. */
const atWords = (at: number): string =>
  `${new Date(at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC'
  })} UTC`;

/**
 * The visitor the canvas's preview shows the page to, said where the page is — their language, device, first visit or
 * not, who is signed in and the date read, when one is chosen — and pressed, the Visitor tab's choices, so a preview is
 * tried without leaving it (its side panels are put away there).
 */
const PreviewVisitor = () => {
  const [[visitor, simulatedAt]] = useBuilderStore(['visitor', 'simulatedAt']);
  const { visitor: who } = useCanvasVisitor();
  const person = who.kind === 'account' ? who.id : who.kind === 'guest' ? 'Guest' : 'You';
  // Docked beside the canvas, its choices are already on screen: the bar only says who the visitor is.
  const docked = use(PreviewDockContext);
  const summary = (
    <>
      <span className="flex items-center gap-1">
        <i className="fa-solid fa-language" />
        {visitor?.language || '—'}
      </span>
      {visitor && <i className={DEVICE_ICON[visitor.device]} title={visitor.device} />}
      <span>{visitor?.returning ? 'Returning' : 'First visit'}</span>
      <span className="flex items-center gap-1">
        <i className="fa-solid fa-user" />
        {person}
      </span>
      {simulatedAt !== undefined && (
        <span className="flex items-center gap-1">
          <i className="fa-regular fa-calendar" />
          {atWords(simulatedAt)}
        </span>
      )}
    </>
  );

  if (docked) {
    return (
      <span
        title="The visitor the preview shows the page to — its choices are beside the canvas"
        className="text-ui-fg-muted flex h-7 shrink-0 items-center gap-2 px-2 text-xs"
      >
        {summary}
      </span>
    );
  }

  return (
    <HeaderPopover
      id="canvas-preview-visitor"
      label="The visitor the preview shows the page to"
      title="The visitor the preview shows the page to — press to change it"
      triggerClassName="border-ui-line text-ui-fg-muted hover:bg-ui-hover hover:text-ui-fg flex h-7 shrink-0 items-center gap-2 rounded-lg border px-2 text-xs"
      trigger={summary}
    >
      {() => (
        <div className="flex max-h-[70vh] flex-col p-3">
          <PreviewPanel />
        </div>
      )}
    </HeaderPopover>
  );
};

export default PreviewVisitor;
