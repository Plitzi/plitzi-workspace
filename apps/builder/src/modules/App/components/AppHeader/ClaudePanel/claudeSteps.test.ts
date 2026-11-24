import { describe, expect, it } from 'vitest';

import { claudeSteps } from './claudeSteps';

describe('claudeSteps', () => {
  const { collaborator, local } = claudeSteps({
    name: 'Ceniza',
    permanentUrl: 'ceniza',
    mcpServer: 'https://mcp-dev.plitzi.com/mcp'
  });
  if (!collaborator) {
    throw new Error('a deployment with an MCP server offers Claude as a collaborator');
  }

  it('adds this deployment’s MCP server to Claude, for it to join the space as a collaborator', () => {
    expect(collaborator.setup.find(line => line.id === 'claude-code')?.text).toBe(
      'claude mcp add --transport http --scope user plitzi https://mcp-dev.plitzi.com/mcp'
    );
    expect(collaborator.prompts.find(line => line.id === 'join')?.text).toContain('my Plitzi space "Ceniza"');
  });

  it('takes the space out by its address into a folder of that name, every choice of create said', () => {
    expect(local.setup.find(line => line.id === 'project')?.text).toBe(
      'plitzi create ceniza --from ceniza --package-manager npm --mode server --source local && cd ceniza && ' +
        'plitzi space use && npm run start:dev'
    );
  });

  it('keeps the project in step with the cloud both ways, never replacing the draft by force unless told', () => {
    expect(local.prompts.some(line => line.text.includes('plitzi space pull'))).toBe(true);
    expect(local.prompts.find(line => line.id === 'push')?.text).toContain('never --force unless I say so');
  });

  it('gives each line an id of its own within its way', () => {
    for (const way of [collaborator, local]) {
      const all = [...way.setup, ...way.prompts];
      expect(new Set(all.map(line => line.id)).size).toBe(all.length);
    }
  });

  it('offers the computer alone where the deployment runs no MCP server', () => {
    const none = claudeSteps({ name: 'Ceniza', permanentUrl: 'ceniza' });

    expect(none.collaborator).toBeUndefined();
    expect(none.local.setup.length).toBeGreaterThan(0);
  });
});
