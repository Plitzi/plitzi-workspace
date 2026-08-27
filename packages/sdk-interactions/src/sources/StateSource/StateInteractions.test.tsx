import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import StateInteractions from './StateInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { InteractionCallback } from '@plitzi/sdk-shared';

vi.mock('@plitzi/sdk-shared/store', () => ({ useCommonStoreSetter: vi.fn() }));

/** Renders the source and hands back what a flow step would call, plus what it wrote. */
const mount = () => {
  const setState = vi.fn();
  vi.mocked(useCommonStoreSetter).mockReturnValue(setState);

  let registered: Record<string, InteractionCallback> = {};
  const interactions = {
    interactionsManager: {},
    useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
      registered = callbacks ?? {};
    }
  } as unknown as InteractionsContextValue;

  render(
    <InteractionsContext value={interactions}>
      <StateInteractions />
    </InteractionsContext>
  );

  return {
    setState,
    run: (params: Record<string, unknown>) =>
      (registered.setState.callback as (values: Record<string, unknown>) => void)(params)
  };
};

describe('StateInteractions', () => {
  it('reads the words the builder writes', () => {
    const { run, setState } = mount();

    run({ key: 'done', type: 'boolean', value: 'true' });
    expect(setState).toHaveBeenCalledWith('runtime.state.done', true);

    run({ key: 'done', type: 'boolean', value: 'false' });
    expect(setState).toHaveBeenLastCalledWith('runtime.state.done', false);
  });

  /**
   * The regression this pins: a step interpolating `{{ someAction.output.done }}` hands over a real boolean, and
   * comparing that against the string turned every `true` into `false` — a flow that read as if it had worked.
   */
  it('keeps a boolean a flow already resolved', () => {
    const { run, setState } = mount();

    run({ key: 'done', type: 'boolean', value: true });
    expect(setState).toHaveBeenCalledWith('runtime.state.done', true);

    run({ key: 'done', type: 'boolean', value: false });
    expect(setState).toHaveBeenLastCalledWith('runtime.state.done', false);
  });

  it('coerces a number and leaves text alone', () => {
    const { run, setState } = mount();

    run({ key: 'count', type: 'number', value: '42' });
    expect(setState).toHaveBeenCalledWith('runtime.state.count', 42);

    run({ key: 'note', type: 'text', value: 'true' });
    expect(setState).toHaveBeenLastCalledWith('runtime.state.note', 'true');
  });
});
