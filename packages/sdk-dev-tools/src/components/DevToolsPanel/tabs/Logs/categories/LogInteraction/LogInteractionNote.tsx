import ContainerCollapsable from '@plitzi/plitzi-ui/ContainerCollapsable';

import type { InteractionNoteParams } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

const iconCollapsed = <i className="fa-solid fa-angle-right text-[10px]" />;
const iconExpanded = <i className="fa-solid fa-angle-down text-[10px]" />;

export type LogInteractionNoteProps = {
  message?: ReactNode;
  params: InteractionNoteParams;
  time?: string;
};

/** A note's value is whatever the step was holding — a resolved param, an object, a token that stayed a token. */
const stringify = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex gap-2">
    <span className="w-24 shrink-0 text-zinc-400 dark:text-zinc-500">{label}</span>
    <span className="min-w-0 grow break-words text-zinc-700 dark:text-zinc-300">{children}</span>
  </div>
);

/**
 * Something a single step reported, on its way through a flow.
 *
 * A step wired to a name nobody registered, a token that would not resolve, a step that threw. None of these has
 * the flow's summary — the flow has not finished — so none of them can be drawn as one. What they do have is the
 * step itself and, usually, the one fact that explains it: what was thrown, or what names WERE registered where
 * this one looked.
 */
const LogInteractionNote = ({ time, message, params }: LogInteractionNoteProps) => {
  const { node, error, available, param, value } = params;

  return (
    <ContainerCollapsable
      className="last:border-b-none w-full border-b border-l-2 border-b-zinc-200 border-l-amber-500 px-2 py-1 transition-colors hover:bg-zinc-50 dark:border-b-zinc-700 dark:hover:bg-zinc-800/50"
      collapsed
    >
      <ContainerCollapsable.Header
        title={
          <div className="flex w-full items-center gap-2 overflow-hidden">
            <span className="shrink-0 font-mono text-zinc-400 tabular-nums dark:text-zinc-500">{time}</span>
            <div className="grow basis-0 truncate text-zinc-700 dark:text-zinc-300">{message}</div>
          </div>
        }
        placement="left"
        className={{ headerTitle: 'overflow-hidden', header: 'hover:bg-transparent dark:hover:bg-transparent' }}
        iconCollapsed={iconCollapsed}
        iconExpanded={iconExpanded}
      />
      <ContainerCollapsable.Content>
        <div className="mx-2 my-1.5 flex flex-col gap-1 rounded border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
          {node?.title && <Row label="Step">{node.title}</Row>}
          {node?.action && <Row label="Action">{node.action}</Row>}
          {node?.elementId && <Row label="Element">{node.elementId}</Row>}
          {param && <Row label="Param">{param}</Row>}
          {value !== undefined && <Row label="Value">{stringify(value)}</Row>}
          {error && <Row label="Error">{error}</Row>}
          {available && (
            <Row label="Registered">{available.length > 0 ? available.join(', ') : 'nothing on that element'}</Row>
          )}
        </div>
      </ContainerCollapsable.Content>
    </ContainerCollapsable>
  );
};

export default LogInteractionNote;
