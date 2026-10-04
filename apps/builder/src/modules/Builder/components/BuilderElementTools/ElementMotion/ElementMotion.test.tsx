import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AppContext from '@pmodules/App/AppContext';

import ElementMotion from './ElementMotion';

import type { ElementMotion as Motion } from '@plitzi/sdk-shared/schema/motion';
import type { AppContextValue } from '@pmodules/App/AppContext';

const mount = (motion?: Motion, canHoldItems = false) => {
  const onUpdate = vi.fn();
  const replayMotion = vi.fn();
  // Only what the panel reads: replaying the canvas's motion.
  const app = { replayMotion } as unknown as AppContextValue;
  render(
    <AppContext value={app}>
      <ElementMotion motion={motion} canHoldItems={canHoldItems} onUpdate={onUpdate} />
    </AppContext>
  );

  return { onUpdate, replayMotion };
};

const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('ElementMotion', () => {
  it('saves an arrival as chosen, with when and how long, and plays it on asking', () => {
    const { onUpdate, replayMotion } = mount(undefined, true);
    change('Arrives', 'fade-up');
    change('When', 'view');
    change('Duration (ms)', '400');
    change('Children one by one (ms)', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(onUpdate).toHaveBeenLastCalledWith(
      'motion',
      { enter: 'fade-up', on: 'view', duration: 400, stagger: 60 },
      true
    );
    expect(replayMotion).toHaveBeenCalled();
  });

  it('keeps the motion it had while a timing is not one, and says why', () => {
    const { onUpdate } = mount({ enter: 'fade' });
    change('Delay (ms)', 'soon');

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/motion\.delay is a number of ms/)).toBeTruthy();
  });

  it('removes the motion once nothing is left to play', () => {
    const { onUpdate } = mount({ loop: 'float' });
    change('Keeps moving', '');

    expect(onUpdate).toHaveBeenLastCalledWith('motion', undefined, true);
  });
});
