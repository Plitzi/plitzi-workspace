import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AppContext from '@pmodules/App/AppContext';

import ElementMotion from './ElementMotion';

import type { ElementMotion as Motion } from '@plitzi/sdk-shared/schema/motion';
import type { AppContextValue } from '@pmodules/App/AppContext';

const mount = (props: { motion?: Motion; canHoldItems?: boolean; isPage?: boolean } = {}) => {
  const onUpdate = vi.fn();
  const replayMotion = vi.fn();
  // Only what the tab reads: replaying the canvas's motion.
  const app = { motionPlaying: false, replayMotion } as unknown as AppContextValue;
  render(
    <AppContext value={app}>
      <ElementMotion {...props} onUpdate={onUpdate} />
    </AppContext>
  );

  return { onUpdate, replayMotion };
};

const choose = (group: string, option: string) =>
  fireEvent.click(within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', { name: option }));

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const summary = () => screen.getByRole('status');

// jsdom draws nothing, so it has no Web Animations: what a tile plays is asserted by what it asks to play.
const animate = vi.fn(() => ({ cancel: vi.fn() }));

beforeEach(() => {
  animate.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

describe('ElementMotion', () => {
  it('saves an arrival as chosen, with when and how long, and reads it back as a sentence', () => {
    const { onUpdate, replayMotion } = mount({ canHoldItems: true });
    choose('Arrives', 'Rise');
    type('Duration (ms)', '400');
    fireEvent.click(screen.getByLabelText('Children arrive one by one'));
    type('Children one by one (ms)', '60');

    expect(onUpdate).toHaveBeenLastCalledWith('motion', { enter: 'fade-up', duration: 400, stagger: 60 }, true);
    expect(summary().textContent).toBe(
      'Each child rises into place, one after another, 60 ms apart, as the page loads, over 400 ms.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play on the canvas' }));
    expect(replayMotion).toHaveBeenCalled();
  });

  it('times an arrival by the scroll, and says so', () => {
    const { onUpdate } = mount({ motion: { enter: 'fade' } });
    choose('Plays', 'In view');

    expect(onUpdate).toHaveBeenLastCalledWith('motion', { enter: 'fade', on: 'view' }, true);
    expect(summary().textContent).toBe('It fades in, as it is scrolled into view.');
    expect(screen.getByText(/at their pace/)).toBeTruthy();
  });

  it('asks when and how long only once there is an arrival to time', () => {
    mount({ motion: { loop: 'float' } });

    expect(screen.queryByLabelText('Duration (ms)')).toBeNull();
    expect(summary().textContent).toBe('It floats gently for as long as the page is open.');
  });

  it('offers children one by one only for an element that holds them', () => {
    mount({ motion: { enter: 'fade' } });

    expect(screen.queryByLabelText('Children arrive one by one')).toBeNull();
  });

  it('keeps the motion it had while a timing is not one, and says why', () => {
    const { onUpdate } = mount({ motion: { enter: 'fade' } });
    type('Delay (ms)', '20000');

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/motion\.delay is a number of ms/);
    expect(screen.getByRole('button', { name: 'Play on the canvas' })).toHaveProperty('disabled', true);
  });

  it('removes the motion once nothing is left to play', () => {
    const { onUpdate } = mount({ motion: { loop: 'float' } });
    choose('Keeps moving', 'Stays still');

    expect(onUpdate).toHaveBeenLastCalledWith('motion', undefined, true);
    expect(summary().textContent).toMatch(/does not move/);
  });

  it('previews a preset on its tile while it is looked at, with the frames the page plays', () => {
    mount();
    const grow = within(screen.getByRole('radiogroup', { name: 'Arrives' })).getByRole('radio', { name: 'Grow' });
    fireEvent.pointerEnter(grow);

    expect(animate).toHaveBeenLastCalledWith(
      [
        { opacity: 0, scale: '0.94' },
        { opacity: 1, translate: '0 0', scale: '1' }
      ],
      expect.objectContaining({ iterations: Infinity })
    );
  });

  it('plays a loop that swings back stronger on the stage, and says so', () => {
    mount();
    fireEvent.pointerEnter(
      within(screen.getByRole('radiogroup', { name: 'Keeps moving' })).getByRole('radio', { name: 'Pulse' })
    );

    expect(animate).toHaveBeenLastCalledWith(
      [{ transform: 'none' }, { transform: 'scale(1.12)' }, { transform: 'none' }],
      expect.objectContaining({ iterations: Infinity })
    );
    expect(screen.getByTitle(/3× stronger here than on the page/)).toBeTruthy();
  });

  it('says a page does not move, rather than offering it motion', () => {
    mount({ isPage: true });

    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText(/A page does not move/)).toBeTruthy();
  });
});
