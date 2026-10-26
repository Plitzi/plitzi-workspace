import { describe, expect, it } from 'vitest';

import { agentPrompt, harnessCommand } from './agentPrompt';

const base = {
  runId: 'shop-shell',
  root: '/p/acme',
  cli: '/p/acme/tmp/plitzi-runs/shop-shell/scratch/dev-1/plitzi',
  goal: 'The shell as the original'
};

// Every run so far had its lead write each agent's prompt by hand; a person new to Plitzi had none to start one with.
describe('an agent’s prompt', () => {
  it('names a developer, its own CLI and its first command — and what is never its', () => {
    const prompt = agentPrompt({ ...base, agent: 'dev-1', started: { roles: ['developer'] } });

    expect(prompt).toContain('You are dev-1, a developer agent');
    expect(prompt).toContain('The CLI is /p/acme/tmp/plitzi-runs/shop-shell/scratch/dev-1/plitzi (PLITZI below)');
    expect(prompt).toContain('cd /p/acme && PLITZI task next` — it takes your next task, waiting until one is ready');
    expect(prompt).not.toMatch(/--agent dev-1|\$\(cat/);
    expect(prompt).toContain('/p/acme/.claude/skills/plitzi-cli/reference/runs.md');
    expect(prompt).toContain('run finish');
    expect(prompt).toContain('"You can stop"');
    expect(prompt).not.toContain('runs-designer.md');
    // 17 of 34 checks failed on typecheck or lint — the project's own scripts first, then the check.
    expect(prompt).toMatch(/`npm run typecheck`, `npm run lint`.*then `PLITZI task check` once/);
  });

  // Carlos: the CLI works for any run, never one kind of it — a run copying nothing was told of an "original".
  it('holds the work to the site the run copies when it copies one, and speaks of none when it does not', () => {
    const copying = agentPrompt({
      ...base,
      agent: 'dev-1',
      started: { roles: ['developer'] },
      reference: 'https://www.example.com'
    });
    expect(copying).toContain('--compare https://www.example.com --width 390,1440');
    expect(copying).toContain('--compare https://www.example.com --same moved,shown,enabled');
    expect(copying).not.toContain('<url>');

    const building = agentPrompt({ ...base, agent: 'dev-1', started: { roles: ['developer'] } });
    expect(building).not.toMatch(/original|--compare|copied site/);
    expect(building).toContain('page play <path> --steps "click <el>; click <el>" --read <el…>');
    const lead = agentPrompt({ ...base, agent: 'lead' });
    expect(lead).not.toContain('--compare');
  });

  it('gives a designer its half and its reviews, a tester its QA, a scout its spikes, at the level it is started at', () => {
    const designer = agentPrompt({ ...base, agent: 'design-1', started: { roles: ['designer', 'developer'] } });
    expect(designer).toContain('runs-designer.md');
    expect(designer).toContain('one `PLITZI task look <task>` a round');
    expect(designer).toContain('a designer,developer agent');
    expect(designer).not.toContain('--role');

    const tester = agentPrompt({ ...base, agent: 'test-1', started: { roles: ['tester'] } });
    expect(tester).toContain('runs-review.md');
    expect(tester).not.toContain('runs-lead.md');
    expect(tester).toContain("every task's QA");
    expect(tester).toContain('--escalate');

    const scout = agentPrompt({ ...base, agent: 'scout-1', started: { roles: ['scout'] } });
    expect(scout).toContain('runs-scout.md');
    expect(scout).toContain('task spike <spike> --done');
    expect(scout).toContain('the lead approves it');
    expect(scout).not.toContain('task unblock');

    expect(agentPrompt({ ...base, agent: 'dev-2', started: { roles: ['developer'], quality: 'high' } })).toContain(
      '--quality high'
    );
    expect(agentPrompt({ ...base, agent: 'dev-1', started: { roles: ['developer'] } })).toContain(
      'Between two tasks or reviews it may say so for a fresh context'
    );
  });

  // The lead is the person's harness, never started again: what reads much — the scope, the reviews — is the agents'.
  it('leaves the scope to a scout and the reviews to the testers when the team has them: the lead manages', () => {
    const prompt = agentPrompt({ ...base, agent: 'lead', scoping: true, team: { scout: true, tester: true } });

    expect(prompt).toContain('You are the manager');
    expect(prompt).toContain('a scout finds out what the ask takes');
    expect(prompt).toContain('task spike s-scope --approve');
    expect(prompt).toContain('read no review yourself');
    expect(prompt).not.toContain('runs-review.md');
    expect(prompt).toContain('run look');
  });

  it('gives the lead the ask, its scope, and how to start its team', () => {
    const prompt = agentPrompt({ ...base, agent: 'lead', scoping: true });

    expect(prompt).toContain('You are the lead of a Plitzi multi-agent run');
    expect(prompt).toContain('The person asked: The shell as the original');
    expect(prompt).toContain('task spike s-scope --done');
    expect(prompt).toContain('run agent <name> --launch');
    // Plitzi's problems go to the run's feedback, never the project's backlog (plain `run notice`).
    expect(prompt).toContain('run notice --plitzi');
  });
  // A run opened on a plan made before it has no scope: its lead, told of one, asked for s-scope and was refused.
  it('tells a lead of a run opened on a plan made before it of no scope', () => {
    const prompt = agentPrompt({ ...base, agent: 'lead' });

    expect(prompt).not.toContain('s-scope');
    expect(prompt).toContain('opened on a plan made before it');
  });
});

describe('the command that starts an agent headless', () => {
  it('reads its prompt from its file where said, and passes the prompt itself where run', () => {
    const prompt = { file: '/p/scratch/dev-1/prompt.md', text: 'You are dev-1' };
    const claude = harnessCommand('claude', prompt, { model: 'claude-sonnet-5-5' });

    expect(claude.line).toBe(
      `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 claude -p "$(cat /p/scratch/dev-1/prompt.md)" --model claude-sonnet-5-5 --permission-mode acceptEdits --allowedTools 'Bash Read Edit Write Glob Grep' --tools 'Bash,Read,Edit,Write,Glob,Grep' --strict-mcp-config`
    );
    expect(claude.command).toBe('claude');
    // Nothing of the person's beside the project: no MCP server (above), no memory of the project kept outside it.
    expect(claude.env).toEqual({ CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' });
    expect(harnessCommand('opencode', prompt, {}).args.slice(0, 2)).toEqual(['run', '--pure']);
    expect(claude.args.slice(0, 2)).toEqual(['-p', 'You are dev-1']);

    expect(harnessCommand('codex', prompt, { model: 'gpt-x' }).line).toBe(
      'codex exec --full-auto -m gpt-x "$(cat /p/scratch/dev-1/prompt.md)"'
    );
    // The team's model is one name for every harness: one this harness does not run is left to its own default, said.
    expect(harnessCommand('codex', prompt, { model: 'claude-sonnet-5-5' })).toMatchObject({
      line: 'codex exec --full-auto "$(cat /p/scratch/dev-1/prompt.md)"'
    });
    expect(harnessCommand('codex', prompt, { model: 'claude-sonnet-5-5' }).model).toBeUndefined();
    expect(harnessCommand('claude', prompt, { model: 'gpt-x' }).line).not.toContain('--model');
    expect(harnessCommand('claude', prompt, { model: 'sonnet' }).model).toBe('sonnet');
    // A session of the CLI's id, kept to resume; or that one resumed (four agents went down mid-task).
    expect(harnessCommand('claude', prompt, {}, { id: 'abc', resume: false }).args).toEqual(
      expect.arrayContaining(['--session-id', 'abc'])
    );
    expect(harnessCommand('claude', prompt, {}, { id: 'abc', resume: true }).args.slice(0, 4)).toEqual([
      '-p',
      'You are dev-1',
      '--resume',
      'abc'
    ]);
    // opencode names a model provider/model: one written otherwise is left to its default.
    expect(harnessCommand('opencode', prompt, { model: 'claude-sonnet-5-5' }).line).toBe(
      'opencode run --pure "$(cat /p/scratch/dev-1/prompt.md)"'
    );
    expect(harnessCommand('opencode', prompt, { model: 'anthropic/claude-sonnet-5-5' }).line).toContain(
      '--model anthropic/claude-sonnet-5-5'
    );
  });

  /** The team's effort, as each harness takes it: Codex's highest is `xhigh`, opencode takes none — left to its own. */
  it('says how hard the agent thinks where the harness takes it', () => {
    const prompt = { file: '/p/prompt.md', text: 'You are lead-2' };

    expect(harnessCommand('claude', prompt, { model: 'claude-opus-5-5', effort: 'high' })).toMatchObject({
      effort: 'high',
      args: expect.arrayContaining(['--effort', 'high']) as unknown
    });
    expect(harnessCommand('claude', prompt, { effort: 'low' }).line).toContain('--effort low');
    expect(harnessCommand('codex', prompt, { effort: 'max' }).line).toContain('-c model_reasoning_effort=xhigh');
    expect(harnessCommand('opencode', prompt, { effort: 'high' })).not.toHaveProperty('effort');
    expect(harnessCommand('claude', prompt).line).not.toContain('--effort');
  });
});
