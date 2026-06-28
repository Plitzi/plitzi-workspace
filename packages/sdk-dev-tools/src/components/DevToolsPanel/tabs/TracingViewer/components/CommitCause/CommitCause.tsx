import clsx from 'clsx';

import type { FlameModel, FlameNode } from '../../helpers';
import type { CommitEntry } from '@plitzi/sdk-shared';

export type CommitCauseProps = {
  commit: CommitEntry;
  model: FlameModel;
  active: FlameNode | undefined;
  onSelectElement: (id: string | undefined) => void;
};

// Past this many chips the rest collapse into a "+N" marker so a mount commit (where every root is a trigger) can't
// flood the header.
const MAX_CHIPS = 6;

// The "why did this commit happen" answer, rendered inline in the commit header so the origin is visible without first
// selecting an element. Two complementary parts: the trigger elements — root-cause re-renders with no rendered ancestor
// (the component that started the cascade) — and the store paths written just before the commit (the data-level cause).
const CommitCause = ({ commit, model, active, onSelectElement }: CommitCauseProps) => {
  const triggers = model.nodes.filter(node => node.trigger);
  if (triggers.length === 0 && commit.causes.length === 0) {
    return null;
  }

  const shownTriggers = triggers.slice(0, MAX_CHIPS);
  const extraTriggers = triggers.length - shownTriggers.length;
  const shownCauses = commit.causes.slice(0, MAX_CHIPS);
  const extraCauses = commit.causes.length - shownCauses.length;

  return (
    <>
      {triggers.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Triggered by
          </span>
          {shownTriggers.map(node => (
            <button
              key={node.id}
              onClick={() => onSelectElement(node.id === active?.id ? undefined : node.id)}
              title={`${node.name} (${node.type}) — root-cause re-render of this commit`}
              className={clsx(
                'flex items-center gap-1 rounded px-1 py-0.5 text-violet-600 dark:text-violet-300',
                node.id === active?.id ? 'bg-violet-500/25' : 'bg-violet-500/10 hover:bg-violet-500/20'
              )}
            >
              <i className="fa-solid fa-bolt text-[8px]" />
              <span className="max-w-32 truncate">{node.name}</span>
            </button>
          ))}
          {extraTriggers > 0 && <span className="text-zinc-400 dark:text-zinc-500">+{extraTriggers}</span>}
        </span>
      )}
      {commit.causes.length > 0 && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            Store write
          </span>
          {shownCauses.map(cause => (
            <span
              key={cause.path}
              title={cause.preview ? `${cause.path}\n${cause.preview}` : cause.path}
              className="max-w-56 truncate rounded bg-zinc-500/10 px-1 py-0.5 font-mono text-[9px] text-zinc-600 dark:text-zinc-300"
            >
              {cause.path}
              {cause.preview && <span className="ml-1 text-zinc-400 dark:text-zinc-500">{cause.preview}</span>}
            </span>
          ))}
          {extraCauses > 0 && <span className="text-zinc-400 dark:text-zinc-500">+{extraCauses}</span>}
        </span>
      )}
    </>
  );
};

export default CommitCause;
