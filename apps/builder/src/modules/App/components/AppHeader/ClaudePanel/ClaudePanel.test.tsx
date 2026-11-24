import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ClaudePanel from './ClaudePanel';

describe('ClaudePanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens on Claude as a collaborator, and turns to the computer’s project and its sync', () => {
    render(<ClaudePanel name="Ceniza" permanentUrl="ceniza" mcpServer="https://mcp.plitzi.com/mcp" />);

    expect(
      screen.getByText('claude mcp add --transport http --scope user plitzi https://mcp.plitzi.com/mcp')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'On your computer' }));

    expect(screen.getByRole('button', { name: 'On your computer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText(/plitzi create ceniza --from ceniza/)).toHaveLength(2);
    expect(screen.getByText(/plitzi space push/)).toBeTruthy();
  });

  it('offers the computer alone where the deployment runs no MCP server', () => {
    render(<ClaudePanel name="Ceniza" permanentUrl="ceniza" />);

    expect(screen.queryByRole('button', { name: 'As a collaborator' })).toBeNull();
    expect(screen.getAllByText(/plitzi create ceniza --from ceniza/)).toHaveLength(2);
  });

  it('says a line was copied — and, with no clipboard, to select it instead', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ClaudePanel name="Ceniza" permanentUrl="ceniza" mcpServer="https://mcp.plitzi.com/mcp" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy: Once, in Claude Code' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      'claude mcp add --transport http --scope user plitzi https://mcp.plitzi.com/mcp'
    );
    expect(screen.getByRole('button', { name: 'Copy: Once, in Claude Code' }).textContent).toBe('Copied');

    vi.stubGlobal('navigator', {});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy: To start' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Copy: To start' }).textContent).toBe('Select it');
  });
});
