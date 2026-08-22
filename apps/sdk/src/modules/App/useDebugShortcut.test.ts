import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import useDebugShortcut from './useDebugShortcut';

const pressShiftF12 = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', shiftKey: true }));

const pressShiftAltD = (target: EventTarget = window) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'KeyD', key: '∂', shiftKey: true, altKey: true, bubbles: true })
  );

describe('the dev-tools shortcut', () => {
  it('toggles on a page that authorized debugging', () => {
    const onToggle = vi.fn();
    renderHook(() => useDebugShortcut({ authorized: true, onToggle }));

    pressShiftF12();

    expect(onToggle).toHaveBeenCalledOnce();
  });

  /**
   * The point of the guard: authorization comes from the page, never from the visitor's keyboard. A published site
   * that never asked for debugging must not hand over the panel, the element ids and the store to anyone who knows
   * the shortcut.
   */
  it('does nothing when the page did not authorize it', () => {
    const onToggle = vi.fn();
    renderHook(() => useDebugShortcut({ authorized: false, onToggle }));

    pressShiftF12();

    expect(onToggle).not.toHaveBeenCalled();
  });

  // The environment is not the rule: mounting the SDK with debugMode is a deliberate act wherever it happens.
  it('still toggles on an authorized page, whatever the environment', () => {
    const onToggle = vi.fn();
    renderHook(() => useDebugShortcut({ authorized: true, onToggle }));

    pressShiftF12();

    expect(onToggle).toHaveBeenCalledOnce();
  });

  /**
   * The chord that can actually be pressed. On a Mac the top row is media keys unless `fn` is held, so a page
   * whose only way in is `shift+F12` has no way in for a good half of the people reading about it.
   */
  it('also toggles on shift+alt+D, whatever that combination types on this layout', () => {
    const onToggle = vi.fn();
    renderHook(() => useDebugShortcut({ authorized: true, onToggle }));

    pressShiftAltD();

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('keeps out of the way while somebody is writing', () => {
    const onToggle = vi.fn();
    renderHook(() => useDebugShortcut({ authorized: true, onToggle }));

    const field = document.createElement('textarea');
    document.body.append(field);
    pressShiftAltD(field);
    field.remove();

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ignores every other key', () => {
    const onToggle = vi.fn();
    renderHook(() => useDebugShortcut({ authorized: true, onToggle }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', shiftKey: true }));
    // Both modifiers are part of the chord: either one alone is an ordinary keystroke.
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', shiftKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', altKey: true }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const onToggle = vi.fn();
    const { unmount } = renderHook(() => useDebugShortcut({ authorized: true, onToggle }));

    unmount();
    pressShiftF12();

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('starts listening the moment the page authorizes it, and stops when it stops', () => {
    const onToggle = vi.fn();
    const { rerender } = renderHook(
      ({ authorized }: { authorized: boolean }) => useDebugShortcut({ authorized, onToggle }),
      { initialProps: { authorized: false } }
    );

    pressShiftF12();
    expect(onToggle).not.toHaveBeenCalled();

    rerender({ authorized: true });
    pressShiftF12();
    expect(onToggle).toHaveBeenCalledOnce();

    rerender({ authorized: false });
    pressShiftF12();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
