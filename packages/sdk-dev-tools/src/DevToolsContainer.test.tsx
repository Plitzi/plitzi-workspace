// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createElement, use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StoreContext, StoreProvider } from '@plitzi/nexus/react';
import { DEV_TOOLS_ATTRIBUTE } from '@plitzi/sdk-shared/devTools';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import DevToolsContainer from './DevToolsContainer';

import type { DevToolsOverlayProps } from './components/DevToolsOverlay';

/**
 * The overlay drawn as what it was handed, with a button for each thing it can ask: what is under test is how the
 * container keeps the panel's state and lays the page out around it, not the panel.
 */
const Overlay = (props: DevToolsOverlayProps) =>
  createElement(
    'div',
    {
      'data-testid': 'overlay',
      'data-collapsed': String(props.collapsed),
      'data-orientation': props.orientation,
      'data-tab': props.tabSelected,
      'data-filter': props.logTypeFilter ?? '',
      // What the panel reads from the page's root store, carried across to its own React root.
      'data-store': String(use(StoreContext) !== undefined)
    },
    createElement('button', { onClick: () => props.onOpen('danger') }, 'open on errors'),
    createElement('button', { onClick: () => props.onOpen() }, 'open'),
    createElement('button', { onClick: () => props.onCollapse() }, 'collapse'),
    createElement('button', { onClick: () => props.onTabSelect('store') }, 'store tab'),
    createElement('button', { onClick: () => props.onChangeOrientation('vertical') }, 'side')
  );

// Loaded lazily by the container, so the factory runs once `Overlay` is defined.
vi.mock('./components/DevToolsOverlay', () => ({ default: Overlay }));

const hooks = vi.hoisted(() => ({
  inspector: vi.fn<(on: boolean) => void>(),
  steps: vi.fn<(on: boolean) => void>(),
  rootStore: vi.fn<(on: boolean) => void>(),
  queries: vi.fn<(on: boolean, instanceId: string) => void>(),
  narrow: false
}));

vi.mock('./agentInspector/useAgentInspector', () => ({ default: hooks.inspector }));
vi.mock('./components/DevToolsPanel/tabs/RunViewer/stepRecorder', () => ({ default: hooks.steps }));
vi.mock('./useRegisterRootStore', () => ({ default: hooks.rootStore }));
vi.mock('./useRegisterQueriesStore', () => ({ default: hooks.queries }));
vi.mock('./useNarrowWindow', async () => ({
  ...(await vi.importActual<object>('./useNarrowWindow')),
  default: () => hooks.narrow
}));

const page = (props: Parameters<typeof DevToolsContainer>[0] = {}) =>
  render(
    <StoreProvider value={{}}>
      <DevToolsContainer {...props}>
        <main>the page</main>
      </DevToolsContainer>
    </StoreProvider>
  );

const overlay = () => screen.findByTestId('overlay');

/** What the panel remembers: `useStorage` keeps `plitzi-sdk.dev-tools.<key>` under the one `plitzi-sdk` item. */
const remembered = (key: string): unknown => {
  const kept: unknown = JSON.parse(localStorage.getItem('plitzi-sdk') ?? '{}');

  return isRecord(kept) && isRecord(kept['dev-tools']) ? kept['dev-tools'][key] : undefined;
};

/** The container's own box: the one around the page's. */
const shell = () => screen.getByText('the page').parentElement?.parentElement;

beforeEach(() => {
  localStorage.clear();
  hooks.narrow = false;
  hooks.inspector.mockClear();
  hooks.steps.mockClear();
  hooks.rootStore.mockClear();
  hooks.queries.mockClear();
});

describe('DevToolsContainer', () => {
  it('is the page alone when the dev tools are off', () => {
    const { container } = page();

    expect(container.innerHTML).toBe('<main>the page</main>');
    expect(hooks.rootStore).toHaveBeenLastCalledWith(false);
    expect(hooks.inspector).toHaveBeenLastCalledWith(false);
  });

  it('gives a test runner the state bridge with no panel', () => {
    const { container } = page({ inspector: true });

    expect(container.innerHTML).toBe('<main>the page</main>');
    expect(hooks.rootStore).toHaveBeenLastCalledWith(true);
    expect(hooks.inspector).toHaveBeenLastCalledWith(true);
  });

  it('starts folded at the bottom on the logs, with the page’s store carried to the panel', async () => {
    page({ enabled: true, instanceId: 'page' });
    const shown = await overlay();

    expect(shown.dataset).toMatchObject({ collapsed: 'true', orientation: 'horizontal', tab: 'logs', store: 'true' });
    expect(hooks.queries).toHaveBeenLastCalledWith(true, 'page');
  });

  it('opens on the errors from the badge, and forgets that filter once a tab is picked', async () => {
    page({ enabled: true });
    fireEvent.click(await screen.findByText('open on errors'));

    expect((await overlay()).dataset).toMatchObject({ collapsed: 'false', tab: 'logs', filter: 'danger' });

    fireEvent.click(screen.getByText('store tab'));

    expect((await overlay()).dataset).toMatchObject({ tab: 'store', filter: '' });
    expect(remembered('tab')).toBe('store');

    fireEvent.click(screen.getByText('collapse'));

    expect((await overlay()).dataset.collapsed).toBe('true');
  });

  it('opens on the tab it was on when the badge names no kind', async () => {
    page({ enabled: true });
    fireEvent.click(await screen.findByText('store tab'));
    fireEvent.click(screen.getByText('open'));

    expect((await overlay()).dataset).toMatchObject({ collapsed: 'false', tab: 'store', filter: '' });
  });

  it('docks beside the page, as tall as the window', async () => {
    page({ enabled: true });
    fireEvent.click(await screen.findByText('side'));

    expect((await overlay()).dataset.orientation).toBe('vertical');
    expect(shell()?.className).toContain('h-screen');
    expect(shell()?.className).not.toContain('flex-col');
  });

  it('stays at the bottom on a window too narrow for it beside the page', async () => {
    hooks.narrow = true;
    page({ enabled: true });
    fireEvent.click(await screen.findByText('side'));

    expect((await overlay()).dataset.orientation).toBe('horizontal');
    expect(remembered('orientation')).toBe('vertical');
  });

  it('leaves a page in the document’s flow while folded, and splits the screen once open', async () => {
    page({ enabled: true, scroll: 'document' });
    const folded = await overlay();

    expect(shell()?.className).not.toContain('overflow-auto');
    expect(folded.closest('.sticky')).not.toBeNull();

    fireEvent.click(screen.getByText('open'));
    const open = await overlay();

    expect(shell()?.className).toContain('overflow-auto');
    expect(open.closest('.sticky')).toBeNull();
  });

  it('draws one panel for two instances, the first one’s until another is picked', async () => {
    render(
      <StoreProvider value={{}}>
        <DevToolsContainer enabled instanceId="first">
          <main>first</main>
        </DevToolsContainer>
        <DevToolsContainer enabled instanceId="second">
          <main>second</main>
        </DevToolsContainer>
      </StoreProvider>
    );
    await overlay();

    expect(screen.getAllByTestId('overlay')).toHaveLength(1);
    expect(screen.getByText('first').closest('.relative')?.contains(screen.getByTestId('overlay'))).toBe(true);
  });

  it('records the steps on a run’s preview only', async () => {
    const { unmount } = page({ enabled: true });
    await overlay();

    expect(hooks.steps).toHaveBeenLastCalledWith(false);

    unmount();
    page({ enabled: true, run: true });
    await overlay();

    expect(hooks.steps).toHaveBeenLastCalledWith(true);
  });

  it('marks a panel drawn in a shadow root from outside, so a capture hides it', async () => {
    const { container } = page({ enabled: true, renderMode: 'shadow', devToolsStyle: '.panel{color:red}' });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(container.querySelector(`[${DEV_TOOLS_ATTRIBUTE}]`)).not.toBeNull();
  });
});
