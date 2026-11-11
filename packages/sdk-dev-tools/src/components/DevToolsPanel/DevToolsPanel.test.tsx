// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { DevToolsContext } from '@plitzi/sdk-shared/devTools/react';

import DevToolsPanel from './DevToolsPanel';

import type { DevToolsPanelProps } from './DevToolsPanel';
import type { Log } from '@plitzi/sdk-shared';
import type { RunSnapshot } from '@plitzi/sdk-shared/runs';

/** Each tab drawn as its name: what is under test is which one the panel draws, not the tab itself. */
const tab = vi.hoisted(() => (name: string) => ({ default: () => createElement('p', { 'data-tab': name }, name) }));

vi.mock('./tabs/ActionsViewer', () => tab('actions'));
vi.mock('./tabs/CacheViewer', () => tab('cache'));
vi.mock('./tabs/ElementsViewer', () => tab('elements'));
vi.mock('./tabs/FlagsViewer', () => tab('flags'));
vi.mock('./tabs/HistoryViewer', () => tab('history'));
vi.mock('./tabs/PluginsViewer/PluginsViewer', () => tab('plugins'));
vi.mock('./tabs/QaViewer', () => tab('qa'));
vi.mock('./tabs/StoreViewer', () => tab('store'));
vi.mock('./tabs/TracingViewer', () => tab('tracing'));
vi.mock('./tabs/VariablesViewer', () => tab('variables'));
vi.mock('./DevToolsSubHeader', () => tab('element picker'));

vi.mock('./tabs/Logs', () => ({
  default: ({ items, onClear }: { items: Log[]; onClear?: () => void }) =>
    createElement('button', { 'data-tab': 'logs', onClick: onClear }, `logs: ${String(items.length)}`)
}));

const run = vi.hoisted(() => {
  const state: { snapshot?: RunSnapshot } = {};

  return state;
});

const RUN: RunSnapshot = {
  runId: 'run-7',
  goal: 'A bakery',
  status: 'running',
  done: 1,
  total: 3,
  at: '2026-11-11T10:00:00.000Z',
  tasks: [],
  attention: []
};

vi.mock('./tabs/RunViewer', () => ({
  default: ({ snapshot }: { snapshot?: RunSnapshot }) => createElement('p', { 'data-tab': 'run' }, snapshot?.runId),
  useRunSnapshot: (previews: boolean) => (previews ? run.snapshot : undefined)
}));

vi.mock('../../scope/useScope', () => ({
  useScopeSelector: () => ({ options: [], value: undefined, onSelect: () => undefined })
}));

const clearLogs = vi.fn();

const panel = (props: Partial<DevToolsPanelProps> = {}) =>
  render(
    <StoreProvider value={{ navigation: { currentPageId: 'home' } }}>
      <DevToolsContext value={{ logs: [], providers: {}, clearLogs }}>
        <DevToolsPanel tabSelected="logs" onTabSelect={() => undefined} {...props} />
      </DevToolsContext>
    </StoreProvider>
  );

const shown = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-tab]')).map(node => node.getAttribute('data-tab'));

beforeEach(() => {
  run.snapshot = undefined;
  clearLogs.mockClear();
  localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
});

describe('DevToolsPanel', () => {
  it.each(['logs', 'cache', 'history', 'variables', 'flags', 'plugins', 'tracing', 'actions'])(
    'draws the %s tab alone',
    tabSelected => {
      const { container } = panel({ tabSelected });

      expect(shown(container)).toEqual([tabSelected]);
    }
  );

  it.each(['store', 'elements'])('draws the element picker over the %s tab', tabSelected => {
    const { container } = panel({ tabSelected });

    expect(shown(container)).toEqual(['element picker', tabSelected]);
  });

  it('shows the logs for a QA tab kept from a page that offered it', () => {
    const { container } = panel({ tabSelected: 'qa' });

    expect(shown(container)).toEqual(['logs']);
    expect(screen.queryByRole('tab', { name: 'QA' })).toBeNull();
  });

  it('draws the QA tab where it is offered', () => {
    const { container } = panel({ tabSelected: 'qa', qa: true });

    expect(shown(container)).toEqual(['qa']);
  });

  it('shows the logs for the Run tab until a run is there, and the run once it is', () => {
    const { container, unmount } = panel({ tabSelected: 'run', run: true });

    expect(shown(container)).toEqual(['logs']);
    expect(screen.queryByRole('tab', { name: 'Run' })).toBeNull();

    unmount();
    run.snapshot = RUN;
    const second = panel({ tabSelected: 'run', run: true });

    expect(shown(second.container)).toEqual(['run']);
    expect(screen.getByText('run-7')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Run' }).getAttribute('aria-selected')).toBe('true');
  });

  it('hands the logs their Clear', () => {
    panel();
    fireEvent.click(screen.getByText('logs: 0'));

    expect(clearLogs).toHaveBeenCalledOnce();
  });

  it('tells which tab was chosen', () => {
    const onTabSelect = vi.fn();
    panel({ onTabSelect });
    fireEvent.click(screen.getByRole('tab', { name: 'Cache' }));

    expect(onTabSelect).toHaveBeenCalledWith('cache');
  });
});
