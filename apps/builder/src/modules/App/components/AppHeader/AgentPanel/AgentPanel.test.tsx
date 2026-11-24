import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AgentPanel from './AgentPanel';

const MCP = 'https://mcp.plitzi.com/mcp';

describe('AgentPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens on Claude Code as a collaborator, and writes each agent’s own way of adding Plitzi', () => {
    render(<AgentPanel name="Ceniza" permanentUrl="ceniza" mcpServer={MCP} />);

    expect(screen.getByText(`claude mcp add --transport http --scope user plitzi ${MCP}`)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Gemini CLI' }));

    expect(screen.getByText(`gemini mcp add --scope user --transport http plitzi ${MCP}`)).toBeTruthy();
    expect(screen.getByText('Then tell Gemini CLI')).toBeTruthy();
  });

  it('turns to the computer’s project, and keeps the choice for the next time it opens', () => {
    const { unmount } = render(<AgentPanel name="Ceniza" permanentUrl="ceniza" mcpServer={MCP} />);
    fireEvent.click(screen.getByRole('button', { name: 'OpenCode' }));
    fireEvent.click(screen.getByRole('button', { name: 'On your computer' }));

    expect(screen.getAllByText(/plitzi create ceniza --from ceniza/)).toHaveLength(2);
    unmount();

    render(<AgentPanel name="Ceniza" permanentUrl="ceniza" mcpServer={MCP} />);

    expect(screen.getByRole('button', { name: 'OpenCode' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'On your computer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('opencode')).toBeTruthy();
  });

  it('offers the computer alone where the deployment runs no MCP server', () => {
    render(<AgentPanel name="Ceniza" permanentUrl="ceniza" />);

    expect(screen.queryByRole('button', { name: 'As a collaborator' })).toBeNull();
    expect(screen.getAllByText(/plitzi create ceniza --from ceniza/)).toHaveLength(2);
  });

  it('says a line was copied — and, with no clipboard, to select it instead', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<AgentPanel name="Ceniza" permanentUrl="ceniza" mcpServer={MCP} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy: Add Plitzi to Claude Code' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(`claude mcp add --transport http --scope user plitzi ${MCP}`);
    expect(screen.getByRole('button', { name: 'Copy: Add Plitzi to Claude Code' }).textContent).toBe('Copied');

    vi.stubGlobal('navigator', {});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy: To start' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Copy: To start' }).textContent).toBe('Select it');
  });
});
