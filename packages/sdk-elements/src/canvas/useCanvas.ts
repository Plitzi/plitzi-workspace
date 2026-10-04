import { use, useCallback, useEffect, useRef, useState } from 'react';

import useAnimationFrame from './useAnimationFrame';
import ElementContext from '../Element/ElementContext';

import type { AnimationFrameOptions, Frame } from './useAnimationFrame';
import type { ElementContextValue } from '../Element/ElementContext';

/** The canvas as it is laid out, in CSS pixels, and how many device pixels each of those holds. */
export interface CanvasSize {
  width: number;
  height: number;
  pixelRatio: number;
}

export interface CanvasOptions<C, S> extends Omit<AnimationFrameOptions, 'target'> {
  /**
   * Once per context — and again after a lost WebGL context comes back: buffers, programs, gradients. What it returns
   * is handed to every `draw`. A `ShaderError` (see `createShaderProgram`) or anything else it throws is printed with
   * the element it belongs to, and nothing is drawn.
   */
  setup?: (context: C, size: CanvasSize) => S;
  /** One frame, in CSS pixels: a 2D context is already scaled to the device's pixels, a WebGL viewport set to them. */
  draw: (context: C, frame: Frame & CanvasSize & { state: S }) => void;
  /** The most device pixels per CSS pixel drawn — a phone at 3 draws nine times a 1× screen's work for little to see. */
  maxPixelRatio?: number;
}

export interface CanvasHandle {
  /** For the `<canvas>`: `<canvas ref={ref} />`, inside the plugin's `RootElement`. */
  ref: (canvas: HTMLCanvasElement | null) => void;
  /** Whether a frame was drawn — until then, what the server rendered (a still image) is what to show. */
  ready: boolean;
  /** What failed — setup, a draw, a shader — when something did; the loop is stopped. */
  error: string | undefined;
  /** Whether it is animating, or holding the one still frame it drew. */
  running: boolean;
}

interface Acquired<C> {
  context: C;
  /** Before each draw: the device pixels the drawing lands on. */
  prepare: (size: CanvasSize) => void;
}

/**
 * What an error is printed under: the plugin's type and the element's name. A hook used outside an element — a story,
 * a test — has neither, and says `canvas`.
 */
const labelOf = (element: Partial<ElementContextValue> | undefined): string =>
  `[plugin ${element?.definition?.type ?? 'canvas'}${element?.id ? ` "${element.id}"` : ''}]`;

/**
 * The machinery every canvas plugin repeats — the device pixel ratio, the size the canvas is laid out at, a still
 * frame where it may not animate, a WebGL context that is lost and comes back, an error that would otherwise leave an
 * empty canvas with no word of why — written once, over `useAnimationFrame`.
 */
const useCanvasLoop = <C, S>(
  acquire: (canvas: HTMLCanvasElement) => Acquired<C> | null,
  { setup, draw, maxPixelRatio = 2, paused, fps }: CanvasOptions<C, S>
): CanvasHandle => {
  const label = labelOf(use(ElementContext));

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, pixelRatio: 1 });
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  // Bumped when a lost context comes back: everything `setup` made belonged to the one that was lost.
  const [generation, setGeneration] = useState(0);
  const acquired = useRef<{ handle: Acquired<C>; state: S } | null>(null);
  const callbacks = useRef({ acquire, setup, draw });
  useEffect(() => {
    callbacks.current = { acquire, setup, draw };
  }, [acquire, setup, draw]);

  const fail = useCallback(
    (cause: unknown) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`${label} ${message}`);
      setError(message);
    },
    [label]
  );

  const ref = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    setCanvas(node);
  }, []);

  // The size it is laid out at, followed — and the drawing buffer kept at that size in device pixels.
  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const measure = (): void => {
      const box = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
      canvas.width = Math.max(1, Math.round(box.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(box.height * pixelRatio));
      setSize({ width: box.width, height: box.height, pixelRatio });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [canvas, maxPixelRatio]);

  // A WebGL context the browser takes back (a driver reset, too many contexts) is waited for, then set up again.
  useEffect(() => {
    if (!canvas) {
      return undefined;
    }

    const lost = (event: Event): void => {
      event.preventDefault();
      acquired.current = null;
      setReady(false);
    };
    const restored = (): void => setGeneration(previous => previous + 1);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);

    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    };
  }, [canvas]);

  // Set up once the canvas has a size, and again for a context that came back.
  useEffect(() => {
    if (!canvas || size.width === 0 || error !== undefined) {
      return;
    }

    try {
      const handle = callbacks.current.acquire(canvas);
      if (!handle) {
        fail(new Error('the browser gave no drawing context (WebGL may be off)'));

        return;
      }

      handle.prepare(size);
      // `setup` is optional: without it the state is nothing, which a `draw` that asked for none never reads.
      const state = callbacks.current.setup ? callbacks.current.setup(handle.context, size) : (undefined as S);
      acquired.current = { handle, state };
    } catch (cause) {
      fail(cause);
    }
  }, [canvas, size, generation, error, fail]);

  const paint = useCallback(
    (frame: Frame) => {
      const current = acquired.current;
      if (!current || error !== undefined) {
        return;
      }

      try {
        current.handle.prepare(size);
        callbacks.current.draw(current.handle.context, { ...frame, ...size, state: current.state });
        setReady(true);
      } catch (cause) {
        acquired.current = null;
        fail(cause);
      }
    },
    [size, error, fail]
  );

  const { running } = useAnimationFrame(paint, { paused: paused || error !== undefined, fps, target: canvasRef });

  // Where it may not move — the builder, less motion asked for, out of sight — one still frame, and again on a resize.
  useEffect(() => {
    if (!running && size.width > 0) {
      paint({ time: 0, delta: 0, frame: 0 });
    }
  }, [running, size, generation, paint]);

  return { ref, ready, error, running };
};

type Canvas2dOptions<S> = CanvasOptions<CanvasRenderingContext2D, S> & {
  attributes?: CanvasRenderingContext2DSettings;
};
type WebGLOptions<C, S> = CanvasOptions<C, S> & { attributes?: WebGLContextAttributes };

/**
 * A 2D canvas that animates: `draw(ctx, { time, width, height })` in CSS pixels, every frame it should.
 *
 * ```tsx
 * const { ref } = useCanvas2d({ draw: (ctx, { time, width, height }) => { ctx.clearRect(0, 0, width, height); … } });
 * return <RootElement className={className}><canvas ref={ref} /></RootElement>;
 * ```
 */
export const useCanvas2d = <S = undefined>({ attributes, ...options }: Canvas2dOptions<S>): CanvasHandle =>
  useCanvasLoop(
    useCallback(
      (canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d', attributes);

        return (
          context && {
            context,
            prepare: ({ pixelRatio }: CanvasSize) => context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
          }
        );
      },
      [attributes]
    ),
    options
  );

/** A WebGL (1) canvas that animates; `setup` compiles with `createShaderProgram`, which says why a shader failed. */
export const useWebGL = <S = undefined>({
  attributes,
  ...options
}: WebGLOptions<WebGLRenderingContext, S>): CanvasHandle =>
  useCanvasLoop(
    useCallback(
      (canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('webgl', attributes);

        return context && { context, prepare: () => context.viewport(0, 0, canvas.width, canvas.height) };
      },
      [attributes]
    ),
    options
  );

/** The same over WebGL 2 — GLSL ES 3.00, where the browser has it; `error` says so where it does not. */
export const useWebGL2 = <S = undefined>({
  attributes,
  ...options
}: WebGLOptions<WebGL2RenderingContext, S>): CanvasHandle =>
  useCanvasLoop(
    useCallback(
      (canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('webgl2', attributes);

        return context && { context, prepare: () => context.viewport(0, 0, canvas.width, canvas.height) };
      },
      [attributes]
    ),
    options
  );
