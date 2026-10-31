// @vitest-environment jsdom
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEV_TOOLS_ATTRIBUTE } from '@plitzi/sdk-shared/devTools';
import { RUN_REPORT_PATH } from '@plitzi/sdk-shared/runs';

import RunReport from './RunReport';
import useStepRecorder, { clearRecordedSteps, recordedSteps } from './stepRecorder';

// A page of the space: two copies of a list's row, a search field, a password, and the dev tools beside it.
const page = (): void => {
  document.body.innerHTML = `
    <main data-plitzi-el="home">
      <button data-plitzi-el="layer-quakes"><span data-plitzi-el="layer-quakes-label">Quakes</span></button>
      <div data-plitzi-el="row">one</div><div data-plitzi-el="row">two</div>
      <input data-plitzi-el="log-search" />
      <input data-plitzi-el="pin" type="password" />
    </main>
    <div ${DEV_TOOLS_ATTRIBUTE}><button id="tab">Run</button></div>`;
};

const element = (selector: string): Element => {
  const found = document.querySelector(selector);
  if (!found) {
    throw new Error(`${selector} is not on the page`);
  }

  return found;
};

afterEach(() => {
  clearRecordedSteps();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

// A run's lead got "with tornadoes selected Strongest breaks" and reproduced it by guessing the layers clicked.
describe('what the person does on a run’s preview', () => {
  it('is kept as steps: each press of the page’s own, and what a field holds once typed — never a password, nor the dev tools', () => {
    page();
    const { unmount } = renderHook(() => useStepRecorder(true));
    // On the button's own text: the button is what was pressed.
    fireEvent.click(element('[data-plitzi-el="layer-quakes-label"]'));
    fireEvent.click(document.querySelectorAll('[data-plitzi-el="row"]')[1]);
    fireEvent.input(element('[data-plitzi-el="log-search"]'), { target: { value: 'zz' } });
    fireEvent.input(element('[data-plitzi-el="log-search"]'), { target: { value: 'zzqq' } });
    fireEvent.input(element('[data-plitzi-el="pin"]'), { target: { value: '1234' } });
    fireEvent.click(element('#tab'));
    unmount();
    fireEvent.click(element('[data-plitzi-el="layer-quakes"]'));

    expect(recordedSteps()).toEqual({
      steps: [
        { kind: 'click', element: 'layer-quakes' },
        { kind: 'click', element: 'row:2' },
        { kind: 'type', element: 'log-search', text: 'zzqq' },
        { kind: 'type', element: 'pin', secret: true }
      ],
      earlier: 0,
      from: '/'
    });
  });

  // Back or forward moved the page where no press took it: the steps kept no longer play to it.
  it('starts again where the browser’s back or forward takes the page', () => {
    page();
    renderHook(() => useStepRecorder(true));
    fireEvent.click(element('[data-plitzi-el="layer-quakes"]'));
    fireEvent(window, new PopStateEvent('popstate'));

    expect(recordedSteps()).toEqual({ steps: [], earlier: 0, from: '/' });
  });
});

describe('a report sent from the Run tab', () => {
  it('goes with the element pointed at — a click the page never sees — and what was done before it', async () => {
    page();
    const sent: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: { body: string }) => {
        sent.push([url, JSON.parse(init.body)]);

        return Promise.resolve(
          new Response(JSON.stringify({ received: true, note: 'The run’s lead gets it' }), { status: 202 })
        );
      })
    );
    renderHook(() => useStepRecorder(true));
    fireEvent.click(element('[data-plitzi-el="layer-quakes"]'));
    render(<RunReport />, { container: element(`[${DEV_TOOLS_ATTRIBUTE}]`) as HTMLElement });

    fireEvent.click(screen.getByRole('button', { name: /Point at it/ }));
    const pressed = vi.fn();
    element('[data-plitzi-el="row"]').addEventListener('click', pressed);
    act(() => {
      fireEvent.click(element('[data-plitzi-el="row"]'));
    });
    expect(pressed).not.toHaveBeenCalled();
    expect(screen.getByText('row:1')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText<HTMLTextAreaElement>(/What is wrong/), {
      target: { value: 'Strongest breaks' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send to the lead/ }));

    await waitFor(() => expect(screen.getByText('The run’s lead gets it')).toBeTruthy());
    expect(sent).toEqual([
      [
        RUN_REPORT_PATH,
        expect.objectContaining({
          text: 'Strongest breaks',
          path: '/',
          element: 'row:1',
          steps: [{ kind: 'click', element: 'layer-quakes' }]
        }) as unknown
      ]
    ]);
    expect(recordedSteps().steps).toEqual([]);
  });

  it('says why it was not sent, and keeps what was written', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'The report was not kept: text' }), { status: 400 }))
      )
    );
    render(<RunReport />);
    fireEvent.change(screen.getByPlaceholderText<HTMLTextAreaElement>(/What is wrong/), {
      target: { value: 'Broken' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Send to the lead/ }));

    await waitFor(() => expect(screen.getByText('Not sent: The report was not kept: text')).toBeTruthy());
    expect(screen.getByPlaceholderText<HTMLTextAreaElement>(/What is wrong/).value).toBe('Broken');
  });
});
