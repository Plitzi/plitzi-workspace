import { describe, expect, it } from 'vitest';

import { agentPrompt, harnessCommand } from './agentPrompt';

const base = {
  runId: 'velada-shell',
  root: '/p/la-velada',
  tokenFile: '/p/la-velada/tmp/plitzi-runs/velada-shell/scratch/dev-1/token',
  goal: 'The shell as the original'
};

// Every run so far had its lead write each agent's prompt by hand; a person new to Plitzi had none to start one with.
describe('an agent’s prompt', () => {
  it('names a developer, its first command, its token on every command after — and what is never its', () => {
    const prompt = agentPrompt({ ...base, agent: 'dev-1', started: { roles: ['developer'] } });

    expect(prompt).toContain('You are dev-1, a developer agent');
    expect(prompt).toContain('cd /p/la-velada && PLITZI task next --role developer --follow --take --agent dev-1');
    expect(prompt).toContain('--token "$(cat /p/la-velada/tmp/plitzi-runs/velada-shell/scratch/dev-1/token)"');
    expect(prompt).toContain('/p/la-velada/.claude/skills/plitzi-cli/reference/runs.md');
    expect(prompt).toContain('run finish');
    expect(prompt).toContain('"You can stop"');
    expect(prompt).not.toContain('runs-designer.md');
  });

  it('gives a designer its half and its reviews, a lead that reviews the lead’s, at the level it is started at', () => {
    const designer = agentPrompt({ ...base, agent: 'design-1', started: { roles: ['designer', 'developer'] } });
    expect(designer).toContain('runs-designer.md');
    expect(designer).toContain('one `PLITZI task look <task>` a round');
    expect(designer).toContain('--role designer,developer');

    const coLead = agentPrompt({ ...base, agent: 'lead-2', started: { roles: ['lead'] } });
    expect(coLead).toContain('runs-lead.md');
    expect(coLead).toContain('as strictly as the lead');

    expect(agentPrompt({ ...base, agent: 'dev-2', started: { roles: ['developer'], quality: 'high' } })).toContain(
      '--quality high'
    );
  });

  it('gives the lead the ask, its scope, and how to start its team', () => {
    const prompt = agentPrompt({ ...base, agent: 'lead' });

    expect(prompt).toContain('You are the lead of a Plitzi multi-agent run');
    expect(prompt).toContain('The person asked: The shell as the original');
    expect(prompt).toContain('task spike s-scope --done');
    expect(prompt).toContain('run agent <name> --launch');
  });
});

describe('the command that starts an agent headless', () => {
  it('reads its prompt from its file where said, and passes the prompt itself where run', () => {
    const prompt = { file: '/p/scratch/dev-1/prompt.md', text: 'You are dev-1' };
    const claude = harnessCommand('claude', prompt, 'claude-sonnet-5-5');

    expect(claude.line).toBe(
      `claude -p "$(cat /p/scratch/dev-1/prompt.md)" --model claude-sonnet-5-5 --permission-mode acceptEdits --allowedTools 'Bash Read Edit Write Glob Grep'`
    );
    expect(claude.command).toBe('claude');
    expect(claude.args.slice(0, 2)).toEqual(['-p', 'You are dev-1']);

    expect(harnessCommand('codex', prompt, 'gpt-x').line).toBe(
      'codex exec --full-auto -m gpt-x "$(cat /p/scratch/dev-1/prompt.md)"'
    );
    // opencode names a model provider/model: one written otherwise is left to its default.
    expect(harnessCommand('opencode', prompt, 'claude-sonnet-5-5').line).toBe(
      'opencode run "$(cat /p/scratch/dev-1/prompt.md)"'
    );
    expect(harnessCommand('opencode', prompt, 'anthropic/claude-sonnet-5-5').line).toContain(
      '--model anthropic/claude-sonnet-5-5'
    );
  });
});
