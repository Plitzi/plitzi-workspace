import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import HostInteractions from './HostInteractions';
import InteractionsContext from '../../InteractionsContext';

import type { InteractionsContextValue } from '../../InteractionsContext';
import type { HostActions, InteractionCallback } from '@plitzi/sdk-shared';

/**
 * The one way out of a space and into the application rendering it.
 *
 * Every other source acts on something the space owns. This one exists so an application SHELL — a sidebar, a
 * switcher, an account menu — can be authored rather than written in the host's own code, which is the one part of
 * a product that otherwise cannot be changed without a release.
 */

const mount = (actions?: HostActions) => {
  let registered: Record<string, InteractionCallback> = {};
  const interactions = {
    interactionsManager: {},
    useInteractions: ({ callbacks }: { callbacks?: Record<string, InteractionCallback> }) => {
      registered = callbacks ?? {};
    }
  } as unknown as InteractionsContextValue;

  render(
    <InteractionsContext value={interactions}>
      <HostInteractions actions={actions} />
    </InteractionsContext>
  );

  return {
    registered,
    call: (params: Record<string, unknown>) =>
      (registered.hostAction.callback as (values: Record<string, unknown>) => void)(params)
  };
};

describe('the bridge into the host', () => {
  it('calls the handler the action names', () => {
    const openSpace = vi.fn();
    const { call } = mount({ openSpace, signOut: vi.fn() });

    call({ action: 'openSpace', value: 'day-plan' });

    expect(openSpace).toHaveBeenCalledOnce();
    expect(openSpace.mock.calls[0][0]).toMatchObject({ action: 'openSpace', value: 'day-plan' });
  });

  it('calls nothing else', () => {
    const signOut = vi.fn();
    const { call } = mount({ openSpace: vi.fn(), signOut });

    call({ action: 'openSpace', value: 'x' });

    expect(signOut).not.toHaveBeenCalled();
  });

  /**
   * A space authored against a host that has not shipped the handler yet does NOTHING — the same answer every other
   * unresolved callback gives. Throwing would take the rest of the flow with it, in a window somebody is watching.
   */
  it.each([
    ['a name the host did not register', { action: 'quit', value: '' }],
    ['no action at all', { value: 'x' }]
  ])('does nothing for %s', (_label, params) => {
    const openSpace = vi.fn();
    const { call } = mount({ openSpace });

    expect(() => call(params)).not.toThrow();
    expect(openSpace).not.toHaveBeenCalled();
  });

  // Registered whether or not the host offers anything, so a space is never the thing that decides it exists.
  it('registers the action even when the host offers none', () => {
    const { registered, call } = mount(undefined);

    expect(registered.hostAction).toBeDefined();
    expect(() => call({ action: 'openSpace' })).not.toThrow();
  });
});
