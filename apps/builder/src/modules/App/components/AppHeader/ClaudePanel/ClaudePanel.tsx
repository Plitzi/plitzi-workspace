import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { clipboardWriter } from '@plitzi/sdk-shared/helpers';

import { claudeSteps } from './claudeSteps';

import type { ClaudeLine, ClaudeSpace } from './claudeSteps';

type Way = 'collaborator' | 'local';

const WAYS: { id: Way; label: string; says: string }[] = [
  {
    id: 'collaborator',
    label: 'As a collaborator',
    says: 'Claude joins this space over Plitzi’s MCP server, signed in as you: every change it makes is the draft here, as it makes it, and it shows among the collaborators above.'
  },
  {
    id: 'local',
    label: 'On your computer',
    says: 'Claude works on this space as a project, with the Plitzi CLI: it runs on your computer, the changes made here come in with a pull, and its own go back as this draft with a push.'
  }
];

/** What a copy came to, for the line it was asked of: done, or a browser with no clipboard to write to. */
type Copied = { id: string; ok: boolean };

const Line = ({ line, copied, onCopy }: { line: ClaudeLine; copied?: Copied; onCopy: (line: ClaudeLine) => void }) => (
  <div className="flex flex-col gap-1">
    <span className="text-ui-fg text-xs font-semibold">{line.label}</span>
    <div className="bg-ui-raised border-ui-line flex items-start gap-2 rounded-lg border p-2">
      <code className="text-ui-fg min-w-0 grow font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap select-all">
        {line.text}
      </code>
      <button
        type="button"
        className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover focus-visible:ring-primary-500 shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-2"
        aria-label={`Copy: ${line.label}`}
        onClick={() => onCopy(line)}
      >
        {copied?.id === line.id ? (copied.ok ? 'Copied' : 'Select it') : 'Copy'}
      </button>
    </div>
    {line.note && <span className="text-ui-fg-subtle text-[11px] leading-snug">{line.note}</span>}
  </div>
);

/**
 * Working on this space with Claude: as a collaborator over the MCP, or on the person's computer with the CLI — what to
 * set up once, with this space's address written in, and what to tell Claude as the work goes, each a line to copy.
 */
const ClaudePanel = (space: ClaudeSpace) => {
  const ways = claudeSteps(space);
  // A deployment with no MCP server offers the computer alone.
  const offered = WAYS.filter(each => each.id === 'local' || ways.collaborator);
  const [picked, setWay] = useState<Way>(offered[0].id);
  const [copied, setCopied] = useState<Copied | undefined>(undefined);
  const way = offered.some(each => each.id === picked) ? picked : 'local';
  const steps = (way === 'collaborator' ? ways.collaborator : undefined) ?? ways.local;
  const chosen = WAYS.find(each => each.id === way);

  const handleCopy = useCallback(async (line: ClaudeLine) => {
    const write = clipboardWriter();
    try {
      if (!write) {
        throw new Error('no clipboard');
      }

      await write(line.text);
      setCopied({ id: line.id, ok: true });
    } catch {
      // A browser that writes nothing here says so on the button: the words are selectable, to copy by hand.
      setCopied({ id: line.id, ok: false });
    }
  }, []);

  return (
    <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4">
      <div className="flex flex-col gap-1">
        <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Claude</span>
        <span className="text-ui-fg text-sm font-semibold">Work on {space.name} with Claude</span>
      </div>
      <div className="bg-ui-raised flex rounded-lg p-0.5" role="group" aria-label="How Claude works on it">
        {offered.map(each => (
          <button
            key={each.id}
            type="button"
            aria-pressed={way === each.id}
            className={clsx(
              'focus-visible:ring-primary-500 grow cursor-pointer rounded-md px-2 py-1 text-xs font-medium outline-none focus-visible:ring-2',
              way === each.id ? 'bg-ui-panel text-ui-fg shadow-sm' : 'text-ui-fg-subtle hover:text-ui-fg'
            )}
            onClick={() => {
              setWay(each.id);
              setCopied(undefined);
            }}
          >
            {each.label}
          </button>
        ))}
      </div>
      {chosen && <span className="text-ui-fg-subtle text-xs leading-snug">{chosen.says}</span>}
      <div className="flex flex-col gap-3">
        {steps.setup.map(line => (
          <Line key={line.id} line={line} copied={copied} onCopy={each => void handleCopy(each)} />
        ))}
      </div>
      <div className="border-ui-line flex flex-col gap-3 border-t pt-3">
        <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Then tell Claude</span>
        {steps.prompts.map(line => (
          <Line key={line.id} line={line} copied={copied} onCopy={each => void handleCopy(each)} />
        ))}
      </div>
      <span className="text-ui-fg-subtle border-ui-line border-t pt-3 text-[11px] leading-snug">
        Not both at once on this space: while it is out as a project, a change made here or over the MCP makes the
        project’s push wait for a pull. Either way it is the draft that changes — nothing is published until you
        Publish.
      </span>
    </div>
  );
};

export default ClaudePanel;
