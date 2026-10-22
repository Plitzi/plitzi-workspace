import path from 'node:path';

import { isPrincipal, LEAD_ROLE } from './leads';
import { SKILLS_ROOT } from '../scaffold/skills';

import type { StartedAgent } from './team';

/**
 * What an agent of a run is started with: who it is, where it works and the run's protocol in short — the skills say it
 * whole. Every run so far had its lead write these by hand (velada-shell's dev-1 and design-1, a page each): a person
 * new to Plitzi had nothing to start an agent with. `plitzi run agent <name>` writes it, and starts it when asked.
 */

/** The harnesses an agent is started in headless — each a command line of its own. */
export const HARNESSES = ['claude', 'codex', 'opencode'] as const;

export type Harness = (typeof HARNESSES)[number];

export const isHarness = (value: unknown): value is Harness =>
  typeof value === 'string' && (HARNESSES as readonly string[]).includes(value);

export interface PromptFor {
  /** The agent, as the team names it — or `lead`. */
  agent: string;
  /** Its roles and level, from the team; none for the lead. */
  started?: Pick<StartedAgent, 'roles' | 'quality'>;
  runId: string;
  /** The project's folder. */
  root: string;
  /** Where its token is kept: what it passes on every command after its first. */
  tokenFile: string;
  /** The run's goal: what the lead was asked. */
  goal: string;
}

const skill = (root: string, file: string): string => path.join(root, SKILLS_ROOT, 'plitzi-cli', 'reference', file);

/** The rules every agent of a run holds to, whatever its role: said once, the skills saying why. */
const rules = (bin: string): string[] => [
  `- Never run \`${bin} run finish\`, \`run abort\`, \`run purge\`, \`run restore\`, \`run allow-finish\` or \`run stop --force\` — a person's. Never \`git stash\`, \`checkout\` or \`reset\`. Stop a server only by its port (\`kill $(lsof -tiTCP:<port> -sTCP:LISTEN)\`), never by name.`,
  '- A wait that ends is not your end: run `task next` again until it says "You can stop".',
  '- When it says you can stop, answer with a short report: what you did, what is uncertain, and every friction with the CLI — the command and what it said.'
];

/** An agent's prompt: the lead's, a lead's that reviews, or one of the team's by its roles. */
export const agentPrompt = ({ agent, started, runId, root, tokenFile, goal }: PromptFor): string => {
  const bin = path.join(root, 'node_modules', '.bin', 'plitzi');
  const token = `--token "$(cat ${tokenFile})"`;
  if (isPrincipal(agent)) {
    return [
      `You are the lead of a Plitzi multi-agent run on the project ${root} (run "${runId}"). The person asked: ${goal}`,
      '',
      `Read first, whole: ${skill(root, 'runs-lead.md')} and ${skill(root, 'runs.md')}.`,
      '',
      `- The CLI is ${bin}. Pass ${token} on every command of the run.`,
      `- The run opens on its scope, your spike: find out what the ask takes (\`page measure\`, \`page shot --compare\`), then end it with the tasks, each with what you found: \`task spike s-scope --done "…" --tasks <stage.json>\` (a stage is its \`tasks\`).`,
      `- Start the team once there are tasks: \`${bin} run agent <name> --launch --harness <yours>\` for each agent \`run plan\` names; \`run watch --until lead\` wakes you for each review, question and block, and says when another agent is worth starting.`,
      '- Review each task: `task show` for its code, one `task look` for its pages, then `task review --approve | --changes "…"`. Then the report (`run report --summary`) and the dry finish (`run finish`): the person applies it.',
      '- What goes wrong in the CLI, note it (`run notice`) — it is fixed after the run, never during it.'
    ].join('\n');
  }

  const roles = started?.roles.join(',') ?? 'developer';
  const designer = started?.roles.includes('designer') === true;
  const coLead = started?.roles.includes(LEAD_ROLE) === true;
  const reading = [
    skill(root, 'runs.md'),
    ...(designer ? [skill(root, 'runs-designer.md')] : []),
    ...(coLead ? [skill(root, 'runs-lead.md')] : [])
  ];

  return [
    `You are ${agent}, a ${roles} agent of a Plitzi multi-agent run on the project ${root} (run "${runId}"). The lead is another agent; a person applies the final merge — never you.`,
    '',
    `Read first, whole: ${reading.join(' and ')}${designer ? ' — and, before your first review, what it names to read' : ''}.`,
    '',
    `- The CLI is ${bin} (PLITZI below). Your first command names you: \`cd ${root} && PLITZI task next --role ${roles}${started?.quality ? ` --quality ${started.quality}` : ''} --follow --take --agent ${agent}\`. From then on every command — inside a task's copy too — passes ${token}; never --agent again.`,
    ...(coLead
      ? ['- You review what you are handed as strictly as the lead, and answer the questions handed to you.']
      : [
          "- Work only in the task's copy (the `work` folder its take prints): start with `PLITZI task context` there, and read the files you change yourself.",
          '- Measure, never guess — every element and width in one call: `PLITZI page measure <path> "<ours> => <theirs>" … --compare <url> --width 390,1440` (`--hover` for a state). Trying values, measure; never `task check` for it.',
          '- Change a batch, then `PLITZI task check` once; then `PLITZI task complete`, and `PLITZI task next --follow --take` again.'
        ]),
    ...(designer
      ? [
          '- A review: one `PLITZI task look <task>` a round, then measure only what differs; send it back only for what its title and acceptance cover, with the values and one `--same` line that proves them — anything else is `PLITZI run notice "…"`. Say your verdict within 8 minutes.'
        ]
      : []),
    ...rules(bin)
  ].join('\n');
};

/** Shell-quoted, for a command line said to a person: what it runs, as it runs it. */
const quoted = (word: string): string => (/^[\w./:=@-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`);

/**
 * The command line that starts an agent in `harness`, headless — said with its prompt read from its file, run with the
 * prompt itself — and the model the team names for it, where the harness takes one. Claude Code is let run the shell
 * and edit files in the project: a run's agent does nothing else.
 */
export const harnessCommand = (
  harness: Harness,
  prompt: { file: string; text: string },
  model?: string
): { command: string; args: string[]; line: string } => {
  const PROMPT = '\0prompt';
  const parts: string[] =
    harness === 'claude'
      ? [
          'claude',
          '-p',
          PROMPT,
          ...(model ? ['--model', model] : []),
          '--permission-mode',
          'acceptEdits',
          '--allowedTools',
          'Bash Read Edit Write Glob Grep'
        ]
      : harness === 'codex'
        ? ['codex', 'exec', '--full-auto', ...(model ? ['-m', model] : []), PROMPT]
        : // opencode names a model provider/model: one the team writes another way is left to its default.
          ['opencode', 'run', ...(model?.includes('/') ? ['--model', model] : []), PROMPT];
  const line = parts.map(part => (part === PROMPT ? `"$(cat ${prompt.file})"` : quoted(part))).join(' ');
  const [command = harness, ...args] = parts.map(part => (part === PROMPT ? prompt.text : part));

  return { command, args, line };
};
