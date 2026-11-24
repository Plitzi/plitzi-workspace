import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { clipboardWriter } from '@plitzi/sdk-shared/helpers';

import { AGENTS, agentSteps, isAgentId } from './agentSteps';

import type { AgentId, AgentLine, AgentSpace } from './agentSteps';

type Way = 'collaborator' | 'local';

const WAYS: { id: Way; label: string; says: string }[] = [
  {
    id: 'collaborator',
    label: 'As a collaborator',
    says: 'It joins this space over Plitzi’s MCP server, signed in as you: every change it makes is this draft, as it makes it, among the collaborators above.'
  },
  {
    id: 'local',
    label: 'On your computer',
    says: 'It works on this space as a project, with the Plitzi CLI, running on your computer: the changes made here come in with a pull, its own go back as this draft with a push.'
  }
];

/** Where the agent and the way last chosen are kept, for this browser alone: a convenience, read and written softly. */
const CHOICE_KEY = 'plitzi-builder-agent-panel';

const readChoice = (): { agent?: unknown; way?: unknown } => {
  try {
    const kept: unknown = JSON.parse(window.localStorage.getItem(CHOICE_KEY) ?? '{}');

    return typeof kept === 'object' && kept !== null ? kept : {};
  } catch {
    return {};
  }
};

const keepChoice = (agent: AgentId, way: Way) => {
  try {
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify({ agent, way }));
  } catch {
    // A browser that keeps nothing asks again next time: nothing is lost but the choice.
  }
};

/** What a copy came to, for the line it was asked of: done, or a browser with no clipboard to write to. */
type Copied = { id: string; ok: boolean };

const SEGMENT =
  'focus-visible:ring-primary-500 cursor-pointer rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap outline-none focus-visible:ring-2';

const Line = ({
  line,
  step,
  copied,
  onCopy
}: {
  line: AgentLine;
  step?: number;
  copied?: Copied;
  onCopy: (line: AgentLine) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-2">
      {step !== undefined && (
        <span className="bg-ui-raised text-ui-fg-subtle flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
          {step}
        </span>
      )}
      <span className="text-ui-fg min-w-0 grow text-xs font-semibold">{line.label}</span>
      <button
        type="button"
        className={clsx(
          'focus-visible:ring-primary-500 flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium outline-none focus-visible:ring-2',
          copied?.id === line.id && copied.ok
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover'
        )}
        aria-label={`Copy: ${line.label}`}
        onClick={() => onCopy(line)}
      >
        <i className={clsx('fa-solid text-[10px]', copied?.id === line.id && copied.ok ? 'fa-check' : 'fa-copy')} />
        {copied?.id === line.id ? (copied.ok ? 'Copied' : 'Select it') : 'Copy'}
      </button>
    </div>
    {line.kind === 'command' ? (
      <code className="bg-ui-raised border-ui-line text-ui-fg block overflow-x-auto rounded-lg border px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre select-all">
        {line.text}
      </code>
    ) : (
      <p className="border-ui-line text-ui-fg rounded-lg border px-2.5 py-2 text-xs leading-relaxed select-all">
        {line.text}
      </p>
    )}
    {line.note && <span className="text-ui-fg-subtle text-[11px] leading-snug">{line.note}</span>}
  </div>
);

/**
 * Working on this space with an AI agent — Claude Code, OpenCode, Gemini CLI or Codex: as a collaborator over the MCP,
 * or on the person's computer with the CLI. What to set up once, with this space's address written in, and what to
 * tell the agent as the work goes, each a line to copy.
 */
const AgentPanel = (space: AgentSpace) => {
  // Read once, as the panel opens: the agent and the way chosen last.
  const [kept] = useState(readChoice);
  const [agent, setAgent] = useState<AgentId>(isAgentId(kept.agent) ? kept.agent : 'claude');
  const [picked, setWay] = useState<Way>(kept.way === 'local' ? 'local' : 'collaborator');
  const [copied, setCopied] = useState<Copied | undefined>(undefined);
  const ways = agentSteps(space, agent);
  // A deployment with no MCP server offers the computer alone.
  const offered = WAYS.filter(each => each.id === 'local' || ways.collaborator);
  const way = offered.some(each => each.id === picked) ? picked : 'local';
  const steps = (way === 'collaborator' ? ways.collaborator : undefined) ?? ways.local;
  const chosen = WAYS.find(each => each.id === way);
  const agentLabel = AGENTS.find(each => each.id === agent)?.label ?? '';

  const choose = useCallback((nextAgent: AgentId, nextWay: Way) => {
    setAgent(nextAgent);
    setWay(nextWay);
    setCopied(undefined);
    keepChoice(nextAgent, nextWay);
  }, []);

  const handleCopy = useCallback(async (line: AgentLine) => {
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
    <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-fuchsia-500 text-white">
          <i className="fa-solid fa-wand-magic-sparkles text-sm" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-ui-fg truncate text-sm font-semibold">Work on {space.name} with an AI agent</span>
          <span className="text-ui-fg-subtle text-xs">The steps, and what to tell it — each a line to copy.</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Agent">
          {AGENTS.map(each => (
            <button
              key={each.id}
              type="button"
              aria-pressed={agent === each.id}
              className={clsx(
                SEGMENT,
                'border',
                agent === each.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                  : 'border-ui-line text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover'
              )}
              onClick={() => choose(each.id, way)}
            >
              {each.label}
            </button>
          ))}
        </div>
        <div className="bg-ui-raised flex rounded-lg p-0.5" role="group" aria-label="How it works on the space">
          {offered.map(each => (
            <button
              key={each.id}
              type="button"
              aria-pressed={way === each.id}
              className={clsx(
                SEGMENT,
                'grow',
                way === each.id ? 'bg-ui-panel text-ui-fg shadow-sm' : 'text-ui-fg-subtle hover:text-ui-fg'
              )}
              onClick={() => choose(agent, each.id)}
            >
              {each.label}
            </button>
          ))}
        </div>
        {chosen && <span className="text-ui-fg-subtle text-xs leading-snug">{chosen.says}</span>}
      </div>
      <div className="flex flex-col gap-3.5">
        {steps.setup.map((line, index) => (
          <Line key={line.id} line={line} step={index + 1} copied={copied} onCopy={each => void handleCopy(each)} />
        ))}
      </div>
      <div className="border-ui-line flex flex-col gap-3.5 border-t pt-4">
        <span className="text-ui-fg-subtle text-[11px] font-bold tracking-wider uppercase">Then tell {agentLabel}</span>
        {steps.prompts.map(line => (
          <Line key={line.id} line={line} copied={copied} onCopy={each => void handleCopy(each)} />
        ))}
      </div>
      <div className="bg-ui-raised text-ui-fg-subtle flex gap-2 rounded-lg px-3 py-2 text-[11px] leading-snug">
        <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
        <span>
          Not both ways at once on this space: while it is out as a project, a change made here or over the MCP makes
          the project’s push wait for a pull. Either way it is the draft that changes — nothing is published until you
          Publish.
        </span>
      </div>
    </div>
  );
};

export default AgentPanel;
