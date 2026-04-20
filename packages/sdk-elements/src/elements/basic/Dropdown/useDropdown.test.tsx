import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import useDropdown from './useDropdown';

const createRect = (overrides: Partial<DOMRect> = {}): DOMRect => ({
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
  ...overrides
});

const mockGetBoundingClientRect = (element: HTMLElement | null, rect: DOMRect) => {
  if (!element) {
    return;
  }

  element.getBoundingClientRect = vi.fn(() => rect);
};

beforeEach(() => {
  // Mock global ResizeObserver
  global.ResizeObserver = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

const mouseEvent = { stopPropagation: vi.fn(), preventDefault: vi.fn() } as unknown as React.MouseEvent;

describe('useDropdown hook', () => {
  let triggerRef: React.RefObject<HTMLDivElement>;
  let popupRef: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    triggerRef = { current: document.createElement('div') };
    popupRef = { current: document.createElement('div') };
  });

  it('should initialize uncontrolled open state', () => {
    const { result } = renderHook(() => useDropdown({ ref: triggerRef }));
    expect(result.current[0]).toBe(false);
  });

  it('should initialize controlled open state', () => {
    const { result } = renderHook(() => useDropdown({ ref: triggerRef, open: true }));
    expect(result.current[0]).toBe(true);
  });

  it('should toggle open state on trigger click when uncontrolled', () => {
    const { result } = renderHook(() => useDropdown({ ref: triggerRef }));
    act(() => {
      result.current[2](mouseEvent);
    });
    expect(result.current[0]).toBe(true);
    act(() => {
      result.current[2](mouseEvent);
    });
    expect(result.current[0]).toBe(false);
  });

  it('should call onChange on trigger click when controlled', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDropdown({ ref: triggerRef, open: true, onChange }));
    act(() => {
      result.current[2](mouseEvent);
    });
    expect(onChange).toHaveBeenCalledWith(false, false);
  });

  it('should not toggle when disabled or loading', () => {
    const { result: disabledResult } = renderHook(() => useDropdown({ ref: triggerRef, disabled: true }));
    act(() => {
      disabledResult.current[2](mouseEvent);
    });
    expect(disabledResult.current[0]).toBe(false);

    const { result: loadingResult } = renderHook(() => useDropdown({ ref: triggerRef, loading: true }));
    act(() => {
      loadingResult.current[2](mouseEvent);
    });
    expect(loadingResult.current[0]).toBe(false);
  });

  it('should not toggle on popup click if closeOnClickPopup is true and controlled', () => {
    const { result } = renderHook(() => useDropdown({ ref: triggerRef, open: true, closeOnClickPopup: true }));
    act(() => {
      result.current[3](mouseEvent);
    });
    expect(result.current[0]).toBe(true);
  });

  it('should not toggle on popup click if disabled/loading or closeOnClickPopup is false', () => {
    const { result: disabledResult } = renderHook(() =>
      useDropdown({ ref: triggerRef, open: true, closeOnClickPopup: true, disabled: true })
    );
    act(() => {
      disabledResult.current[3]({} as React.MouseEvent);
    });
    expect(disabledResult.current[0]).toBe(true);

    const { result: loadingResult } = renderHook(() =>
      useDropdown({ ref: triggerRef, open: true, closeOnClickPopup: true, loading: true })
    );
    act(() => {
      loadingResult.current[3]({} as React.MouseEvent);
    });
    expect(loadingResult.current[0]).toBe(true);

    const { result: closeFalseResult } = renderHook(() =>
      useDropdown({ ref: triggerRef, open: true, closeOnClickPopup: false })
    );
    act(() => {
      closeFalseResult.current[3]({} as React.MouseEvent);
    });
    expect(closeFalseResult.current[0]).toBe(true);
  });

  const placements = ['top', 'bottom', 'left', 'right'] as const;

  placements.forEach(placement => {
    it(`should calculate floatingPosition correctly for placement ${placement}`, () => {
      const triggerRect = createRect({ top: 100, left: 100, bottom: 150, right: 150, width: 50, height: 50 });
      const popupRect = createRect({ width: 30, height: 20 });

      mockGetBoundingClientRect(triggerRef.current, triggerRect);
      mockGetBoundingClientRect(popupRef.current, popupRect);

      const { result } = renderHook(() => useDropdown({ ref: triggerRef, popupRef, open: true, placement }));

      const floatingPos = result.current[5];
      expect(floatingPos).toBeDefined();
      if (!floatingPos) {
        return;
      }

      switch (placement) {
        case 'top':
          expect(floatingPos.top).toBe(triggerRect.top - popupRect.height);
          expect(floatingPos.left).toBe(triggerRect.left);
          break;
        case 'bottom':
          expect(floatingPos.top).toBe(triggerRect.bottom);
          expect(floatingPos.left).toBe(triggerRect.left);
          break;
        case 'left':
          expect(floatingPos.top).toBe(triggerRect.top);
          expect(floatingPos.left).toBe(triggerRect.left - popupRect.width);
          break;
        case 'right':
          expect(floatingPos.top).toBe(triggerRect.top);
          expect(floatingPos.left).toBe(triggerRect.right);
          break;
      }
    });
  });

  it('should apply offsetX and offsetY', () => {
    const triggerRect = createRect({ top: 100, left: 100, bottom: 150, right: 150, width: 50, height: 50 });
    const popupRect = createRect({ width: 30, height: 20 });

    mockGetBoundingClientRect(triggerRef.current, triggerRect);
    mockGetBoundingClientRect(popupRef.current, popupRect);

    const offsetX = 10;
    const offsetY = 5;

    const { result } = renderHook(() =>
      useDropdown({ ref: triggerRef, popupRef, open: true, placement: 'bottom', offsetX, offsetY })
    );

    const floatingPos = result.current[5];
    expect(floatingPos).toBeDefined();
    if (!floatingPos) {
      return;
    }

    expect(floatingPos.top).toBe(triggerRect.bottom + offsetY);
    expect(floatingPos.left).toBe(triggerRect.left + offsetX);
  });

  it('should clamp horizontally and vertically within viewport', () => {
    const vw = 200;
    const vh = 200;

    const triggerRect = createRect({ top: 180, left: 180, bottom: 230, right: 230, width: 50, height: 50 });
    const popupRect = createRect({ width: 100, height: 50 });

    mockGetBoundingClientRect(triggerRef.current, triggerRect);
    mockGetBoundingClientRect(popupRef.current, popupRect);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: vw });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: vh });

    const { result } = renderHook(() => useDropdown({ ref: triggerRef, popupRef, open: true, placement: 'bottom' }));

    const floatingPos = result.current[5];
    expect(floatingPos).toBeDefined();
    if (!floatingPos) {
      return;
    }

    expect(floatingPos.left).toBe(triggerRect.right - popupRect.width);
    expect(floatingPos.top).toBeLessThanOrEqual(vh - popupRect.height);
  });

  // it('should handle SSR safety with undefined window', () => {
  //   const originalWindow = global.window;
  //   // @ts-ignore
  //   delete global.window;

  //   const triggerRect = createRect({ top: 10, left: 10, bottom: 60, right: 60, width: 50, height: 50 });
  //   mockGetBoundingClientRect(triggerRef.current, triggerRect);

  //   const { result } = renderHook(() => useDropdown({ ref: triggerRef, open: true }));

  //   expect(result.current[5]).toBeUndefined();

  //   global.window = originalWindow;
  // });
});
