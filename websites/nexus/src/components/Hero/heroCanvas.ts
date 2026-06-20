// Shared 2D-canvas setup for every arcade engine. Centralising the context hints and the backing-store sizing keeps all
// games consistent and puts the GPU tuning in one place instead of copy-pasted into each engine.

// `desynchronized` lets the browser bypass the compositor's frame sync for this 2D context — lower input-to-paint
// latency and less GPU work for canvases that redraw every frame. `alpha` stays on so the playfield blends over the hero
// backdrop. Engines that draw an opaque background still benefit from the desync hint.
export const getGameContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null =>
  canvas.getContext('2d', { alpha: true, desynchronized: true });

// Device-pixel-ratio is capped at 2: past that the extra backing-store pixels burn GPU fill-rate with no visible gain on
// these animated canvases. Sizes the backing store, resets the transform to CSS pixels and returns the CSS draw size.
export const sizeCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = rect.width;
  const height = rect.height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { width, height };
};
