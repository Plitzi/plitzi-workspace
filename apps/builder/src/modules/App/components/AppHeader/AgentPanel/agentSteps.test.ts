import { describe, expect, it } from 'vitest';

import { AGENTS, agentSteps } from './agentSteps';

import type { AgentId } from './agentSteps';

const SPACE = { name: 'Ceniza', permanentUrl: 'ceniza', mcpServer: 'https://mcp-dev.plitzi.com/mcp' };

const stepsFor = (agent: AgentId) => {
  const { collaborator, local } = agentSteps(SPACE, agent);
  if (!collaborator) {
    throw new Error('a deployment with an MCP server offers the agent as a collaborator');
  }

  return { collaborator, local };
};

describe('agentSteps', () => {
  it('adds this deployment’s MCP server to each agent the way that agent adds one', () => {
    const added = Object.fromEntries(
      AGENTS.map(agent => [agent.id, stepsFor(agent.id).collaborator.setup.find(line => line.id === 'add')?.text])
    );

    expect(added).toEqual({
      claude: 'claude mcp add --transport http --scope user plitzi https://mcp-dev.plitzi.com/mcp',
      opencode: 'opencode mcp add plitzi --url https://mcp-dev.plitzi.com/mcp',
      gemini: 'gemini mcp add --scope user --transport http plitzi https://mcp-dev.plitzi.com/mcp',
      codex: 'codex mcp add plitzi --url https://mcp-dev.plitzi.com/mcp'
    });
  });

  it('signs in as each agent does, and says the space has to be chosen there or the agent sees none of it', () => {
    const signedIn = Object.fromEntries(
      AGENTS.map(agent => [agent.id, stepsFor(agent.id).collaborator.setup.find(line => line.id === 'login')])
    );

    expect(Object.fromEntries(Object.entries(signedIn).map(([id, line]) => [id, line?.text]))).toEqual({
      claude: '/mcp',
      opencode: 'opencode mcp auth plitzi',
      gemini: '/mcp auth plitzi',
      codex: 'codex mcp login plitzi'
    });
    expect(signedIn.claude?.label).toBe('Sign in, and choose Ceniza');
    expect(signedIn.gemini?.note).toContain(
      'choose Ceniza — the agent sees that space alone, and none of it until it is chosen'
    );
  });

  it('offers the Claude app’s connector beside Claude Code alone', () => {
    expect(stepsFor('claude').collaborator.setup.map(line => line.id)).toEqual(['add', 'login', 'claude-app']);
    expect(stepsFor('gemini').collaborator.setup.map(line => line.id)).toEqual(['add', 'login']);
  });

  it('takes the space out by its address into a folder of that name, every choice of create said', () => {
    expect(stepsFor('opencode').local.setup.find(line => line.id === 'project')?.text).toBe(
      'plitzi create ceniza --from ceniza --package-manager npm --mode server --source local && cd ceniza && ' +
        'plitzi space use && npm run start:dev'
    );
    expect(stepsFor('gemini').local.setup.find(line => line.id === 'start')?.text).toBe('gemini');
  });

  it('tells an agent that does not read AGENTS.md by itself to read it', () => {
    expect(stepsFor('gemini').local.setup.find(line => line.id === 'start')?.note).toContain('read AGENTS.md');
    expect(stepsFor('codex').local.prompts.find(line => line.id === 'all')?.text).toContain('ceniza/AGENTS.md');
    expect(stepsFor('claude').local.prompts.find(line => line.id === 'all')?.text).toContain('ceniza/CLAUDE.md');
  });

  it('keeps the project in step with the cloud both ways, never replacing the draft by force unless told', () => {
    const { local } = stepsFor('claude');

    expect(local.prompts.some(line => line.text.includes('plitzi space pull'))).toBe(true);
    expect(local.prompts.find(line => line.id === 'push')?.text).toContain('never --force unless I say so');
  });

  it('offers the computer alone where the deployment runs no MCP server', () => {
    const none = agentSteps({ name: 'Ceniza', permanentUrl: 'ceniza' }, 'claude');

    expect(none.collaborator).toBeUndefined();
    expect(none.local.setup.length).toBe(3);
  });
});
