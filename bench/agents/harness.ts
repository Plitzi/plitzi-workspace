import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { fromClaudeCode, fromOpenCode } from './events';
import { scratch } from './fixtures';

import type { RunRecord } from './events';
import type { Scenario } from './tasks';

/**
 * The two harnesses an agent runs in — Claude Code for Claude, OpenCode for the rest (a local model through Ollama) —
 * started the same way for every task: nothing of the person's own setup, only the tools the scenario needs, and in
 * the CLI scenario a shell that runs nothing but `npx plitzi` and `npm run`.
 */

export interface Model {
  harness: 'claude' | 'opencode';
  /** As the harness names it: `claude-haiku-4-5-20251001`, `ollama/qwen3.6:latest`. */
  id: string;
}

/** `claude:claude-haiku-4-5-20251001`, `opencode:ollama/qwen3.6:latest`. */
export const parseModel = (label: string): Model | undefined => {
  const at = label.indexOf(':');
  const harness = label.slice(0, at);

  return at > 0 && (harness === 'claude' || harness === 'opencode') ? { harness, id: label.slice(at + 1) } : undefined;
};

export type Context = 'none' | 'core' | 'full';

export interface Invocation {
  model: Model;
  scenario: Scenario;
  prompt: string;
  /** Where the agent works: the project, or an empty folder beside an MCP server. */
  dir: string;
  mcpUrl?: string;
  context: Context;
  /** Every reference of the skills, in one file — handed to the model up front at the `full` context level. */
  references?: string;
  maxTurns: number;
  timeoutMs: number;
}

const CLI_TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob'];

const CLI_ALLOWED = ['Bash(npx plitzi:*)', 'Bash(npm run:*)', 'Read', 'Edit', 'Write', 'Grep', 'Glob'];

/** A command's stdout, line by line, ended by its own exit or by the timeout. */
const linesOf = (command: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<string[]> =>
  new Promise(resolve => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
    let buffered = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffered += chunk.toString('utf-8');
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('close', () => {
      clearTimeout(timer);
      resolve(buffered.split('\n').filter(line => line.trim() !== ''));
    });
  });

const claudeArgs = async (invocation: Invocation): Promise<string[]> => {
  const args = [
    '-p',
    invocation.prompt,
    '--model',
    invocation.model.id,
    '--output-format',
    'stream-json',
    '--verbose',
    '--max-turns',
    String(invocation.maxTurns),
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--permission-mode',
    'acceptEdits'
  ];
  if (invocation.scenario === 'mcp') {
    // No built-in tool: the agent works through the MCP alone. Without a server (the harness's own floor), nothing.
    args.push('--tools', '');
    if (invocation.mcpUrl) {
      const config = path.join(await scratch('mcp-config'), 'mcp.json');
      await fs.writeFile(config, JSON.stringify({ mcpServers: { plitzi: { type: 'http', url: invocation.mcpUrl } } }));
      args.push('--mcp-config', config, '--allowedTools', 'mcp__plitzi');
    }
  } else {
    args.push('--tools', CLI_TOOLS.join(','), '--allowedTools', ...CLI_ALLOWED);
  }

  if (invocation.context === 'full' && invocation.references) {
    args.push('--append-system-prompt-file', invocation.references);
  }

  return args;
};

/** OpenCode reads its configuration from the folder it runs in: the model's provider, the MCP server, what it may run. */
const openCodeConfig = async (invocation: Invocation): Promise<void> => {
  const [provider, ...rest] = invocation.model.id.split('/');
  const model = rest.join('/');
  const config = {
    $schema: 'https://opencode.ai/config.json',
    ...(provider === 'ollama'
      ? {
          provider: {
            ollama: {
              npm: '@ai-sdk/openai-compatible',
              options: { baseURL: 'http://localhost:11434/v1' },
              models: { [model]: { name: model } }
            }
          }
        }
      : {}),
    ...(invocation.mcpUrl ? { mcp: { plitzi: { type: 'remote', url: invocation.mcpUrl } } } : {}),
    permission: {
      edit: invocation.scenario === 'cli' ? 'allow' : 'deny',
      bash: invocation.scenario === 'cli' ? { 'npx plitzi *': 'allow', 'npm run *': 'allow', '*': 'deny' } : 'deny',
      webfetch: 'deny'
    },
    ...(invocation.context === 'full' && invocation.references ? { instructions: [invocation.references] } : {})
  };
  await fs.writeFile(path.join(invocation.dir, 'opencode.json'), JSON.stringify(config, null, 2));
};

export const runAgent = async (invocation: Invocation): Promise<RunRecord> => {
  if (invocation.context === 'none') {
    await fs.rm(path.join(invocation.dir, '.claude/skills'), { recursive: true, force: true });
  }

  if (invocation.model.harness === 'claude') {
    return fromClaudeCode(await linesOf('claude', await claudeArgs(invocation), invocation.dir, invocation.timeoutMs));
  }

  await openCodeConfig(invocation);

  return fromOpenCode(
    await linesOf(
      'opencode',
      ['run', '--model', invocation.model.id, '--format', 'json', invocation.prompt],
      invocation.dir,
      invocation.timeoutMs
    )
  );
};

/**
 * What one turn costs before the model reads anything of a task — the harness's system prompt and its own tools — for
 * this model and scenario, so it is not counted as Plitzi's: the input of a run asked for one word in an empty folder,
 * with no MCP server and no skill. The MCP's tool listing and the skills are Plitzi's, and stay counted.
 */
export const overheadOf = async (model: Model, scenario: Scenario, timeoutMs: number): Promise<number> => {
  const dir = await scratch('overhead');
  try {
    const record = await runAgent({
      model,
      scenario,
      prompt: 'Reply with the single word: ok',
      dir,
      context: 'none',
      maxTurns: 1,
      timeoutMs
    });

    return record.turns[0]?.input ?? 0;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};
