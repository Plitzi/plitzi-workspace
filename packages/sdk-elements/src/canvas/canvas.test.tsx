/* eslint-disable quotes -- a driver's log quotes the source, which reads best in the other quotes */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlitziServiceContext } from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { createShaderProgram, ShaderError, useCanvas2d } from './index';

import type { Frame } from './index';
import type { PlitziServiceContextValue } from '@plitzi/sdk-shared';

/** A 2D context with only what the hook and these draws touch. */
const fake2d = () => ({ setTransform: vi.fn(), clearRect: vi.fn() });

const service = (previewMode: boolean) =>
  ({
    settings: { previewMode },
    root: { baseElementId: 'root' },
    contexts: {}
  }) as unknown as PlitziServiceContextValue;

type Draw = (context: unknown, frame: Frame & { width: number; pixelRatio: number }) => void;

/** The hook's answer, written where a test reads it: on the canvas itself. */
const Probe = ({ draw }: { draw: Draw }) => {
  const { ref, running, ready, error } = useCanvas2d({ draw });

  return <canvas ref={ref} data-running={running} data-ready={ready} data-error={error} />;
};

const mount = (draw: Draw, previewMode = true) => {
  const { container } = render(
    <PlitziServiceContext value={service(previewMode)}>
      <Probe draw={draw} />
    </PlitziServiceContext>
  );
  const canvas = container.querySelector('canvas');
  if (!canvas) {
    throw new Error('no canvas rendered');
  }

  return canvas;
};

describe('useCanvas2d', () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    // The shared setup's stand-in cannot be constructed; the hook only needs one that can.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 50
    } as DOMRect);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3);
    // jsdom has no 2D context of its own: hand one over, as a browser would.

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fake2d() as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** Runs the frames the browser was asked for, at `time` ms. */
  const runFrames = (time: number) => {
    const due = frames.splice(0);
    act(() => due.forEach(callback => callback(time)));
  };

  it('sizes the drawing buffer to the device, capped, and draws one still frame where it may not move', () => {
    const draw = vi.fn<Draw>();
    const canvas = mount(draw, false);

    // 100×50 CSS pixels at a ratio of 3, capped at 2.
    expect([canvas.width, canvas.height]).toEqual([200, 100]);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][1]).toMatchObject({ time: 0, width: 100, pixelRatio: 2 });
    expect(canvas.dataset).toMatchObject({ running: 'false', ready: 'true' });
    expect(frames).toEqual([]);
  });

  it('draws every frame on a live page, the time counting only while it runs', () => {
    const draw = vi.fn<Draw>();
    const canvas = mount(draw);
    runFrames(1000);
    runFrames(1016);

    expect(canvas.dataset.running).toBe('true');
    expect(draw.mock.calls.map(([, frame]) => frame.time)).toEqual([0, 16]);
  });

  it('holds still for a visitor who asked for less motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      query => ({ matches: query.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never
    );
    const draw = vi.fn<Draw>();
    const canvas = mount(draw);

    expect(canvas.dataset.running).toBe('false');
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('says what failed, and where, instead of leaving an empty canvas — and stops', () => {
    const said = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const canvas = mount(() => {
      throw new Error('fragment shader failed: ERROR: 0:3: syntax error');
    }, false);

    expect(said).toHaveBeenCalledWith('[plugin canvas] fragment shader failed: ERROR: 0:3: syntax error');
    expect(canvas.dataset).toMatchObject({ error: 'fragment shader failed: ERROR: 0:3: syntax error', ready: 'false' });
  });
});

describe('createShaderProgram', () => {
  /** A WebGL context that compiles whatever has no `bad` in it. */
  const fakeGl = () => {
    const sources = new Map<object, string>();

    return {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      createShader: () => ({}),
      shaderSource: (shader: object, source: string) => sources.set(shader, source),
      compileShader: () => undefined,
      getShaderParameter: (shader: object) => !sources.get(shader)?.includes('bad'),
      getShaderInfoLog: () => "ERROR: 0:1: '196' : syntax error — an int where a float is wanted",
      deleteShader: vi.fn(),
      createProgram: () => ({ program: true }),
      attachShader: () => undefined,
      linkProgram: () => undefined,
      getProgramParameter: () => true,
      getProgramInfoLog: () => '',
      deleteProgram: vi.fn()
    };
  };

  it('links what compiles, and throws what the driver said about what does not — naming the stage', () => {
    const gl = fakeGl();
    // A fake context, typed by what the helper reads.
    const context = gl as unknown as WebGLRenderingContext;

    expect(createShaderProgram(context, { vertex: 'ok', fragment: 'ok' })).toEqual({ program: true });
    expect(() => createShaderProgram(context, { vertex: 'ok', fragment: 'bad' })).toThrow(
      new ShaderError('fragment', "ERROR: 0:1: '196' : syntax error — an int where a float is wanted")
    );
  });
});
