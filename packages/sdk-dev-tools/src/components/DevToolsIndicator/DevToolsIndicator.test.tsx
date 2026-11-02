// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DevToolsIndicator from './DevToolsIndicator';
import { sideAt } from './sideAt';

/**
 * The badge sat in the bottom-left corner of every page in debug, over whatever the space put there — the dashboard's
 * plan panel, a cookie banner. It is dragged to the other bottom corner, and the browser remembers which.
 */

const CONTAINER = { left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0 };

const badge = () => screen.getByTitle('Plitzi dev tools — drag to the other corner');

const drag = (from: number, to: number) => {
  fireEvent.pointerDown(badge(), { clientX: from, pointerId: 1 });
  fireEvent.pointerMove(badge(), { clientX: to, pointerId: 1 });
  fireEvent.pointerUp(badge(), { clientX: to, pointerId: 1 });
  fireEvent.click(badge());
};

beforeEach(() => {
  localStorage.clear();
  // jsdom lays nothing out: the badge's container is a box of a known width, and pointer capture is a no-op.
  vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
  vi.spyOn(document.body, 'getBoundingClientRect').mockReturnValue({ ...CONTAINER, toJSON: () => CONTAINER });
  HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the dev-tools badge', () => {
  it('lands on the half of its container it was let go in', () => {
    expect(sideAt(100, CONTAINER)).toBe('left');
    expect(sideAt(900, CONTAINER)).toBe('right');
  });

  it('opens the panel on a click', () => {
    const onOpen = vi.fn();
    render(<DevToolsIndicator onOpen={onOpen} />);

    fireEvent.click(badge());

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('moves to the corner it is dragged to, opens nothing, and is there again next time', () => {
    const onOpen = vi.fn();
    const { container, unmount } = render(<DevToolsIndicator onOpen={onOpen} />);

    expect(container.firstElementChild?.className).toContain('left-3');

    drag(40, 900);

    expect(onOpen).not.toHaveBeenCalled();
    expect(container.firstElementChild?.className).toContain('right-3');

    unmount();
    const again = render(<DevToolsIndicator onOpen={onOpen} />);

    expect(again.container.firstElementChild?.className).toContain('right-3');
  });

  // A hand is not perfectly still: a press that moved a pixel or two is still a click.
  it('takes a press that barely moved for a click', () => {
    const onOpen = vi.fn();
    render(<DevToolsIndicator onOpen={onOpen} />);

    drag(40, 42);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
