import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StoreProvider } from '@plitzi/nexus/react';
import { InteractionsContext } from '@plitzi/sdk-interactions';

import SpaceContainerInternal from './SpaceContainerInternal';

import type { InteractionCallback } from '@plitzi/sdk-shared';

const track = vi.hoisted(() => vi.fn());

vi.mock('../Analytics/reporterRegistry', () => ({ track }));

vi.mock('@plitzi/plitzi-ui/Toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

/** The space's steps as it registers them, by name. */
const registered = (): Record<string, InteractionCallback> => {
  let callbacks: Record<string, InteractionCallback> = {};
  const useInteractions = ({ callbacks: given }: { callbacks: Record<string, InteractionCallback> }) => {
    callbacks = given;
  };

  render(
    <StoreProvider value={{ experiments: { assigned: { heroTest: 'b' } } }}>
      {/* The space reads `useInteractions` of the context alone. */}
      <InteractionsContext value={{ useInteractions } as never}>
        <SpaceContainerInternal>{null}</SpaceContainerInternal>
      </InteractionsContext>
    </StoreProvider>
  );

  return callbacks;
};

describe('the reachGoal step', () => {
  it('reports the goal with the visitor’s variants', async () => {
    await registered().reachGoal.callback?.({ goal: 'signup' });

    expect(track).toHaveBeenCalledWith('$goal', { goal: 'signup', 'ab.heroTest': 'b' });
  });

  it('counts nothing for a name the console could not show, and says so', async () => {
    track.mockClear();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await registered().reachGoal.callback?.({ goal: 'sign up' });

    expect(track).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain('nothing was counted');
  });
});
