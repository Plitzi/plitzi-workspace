# Drawing and animating in a plugin

A plugin that draws on a canvas — a WebGL hero, a field of particles — takes the canvas from `useCanvas2d`, `useWebGL`
or `useWebGL2`, and writes only `setup` (once per context) and `draw` (each frame, in CSS pixels):

```tsx
import { createShaderProgram, RootElement, useWebGL } from '@plitzi/plitzi-sdk';

const { ref, ready, error } = useWebGL({
  setup: gl => ({ program: createShaderProgram(gl, { vertex: VERTEX, fragment: FRAGMENT }) }),
  draw: (gl, { time, state }) => { gl.useProgram(state.program); /* uniforms, drawArrays */ }
});
return <RootElement className={className}>{!ready && <img src={still} alt="" />}<canvas ref={ref} /></RootElement>;
```

It sizes the canvas to the device (at most 2× — `maxPixelRatio`), follows its size, and animates only while somebody
can see it move: on a live page (in the builder it draws one still frame), for a visitor who did not ask for less
motion, with the tab in front and the canvas on screen; `paused` holds it (bind it to a hover). A shader that does not
compile — GLSL ES 1.0 wants `196.0`, not `196` — throws a `ShaderError` with the driver's log, printed as
`[plugin <type> "<id>"] fragment shader failed: …` (`plitzi check` lists it under the console) and `error` says it;
show the still image meanwhile, as above. `useAnimationFrame(onFrame, { target })` is the same loop for motion that
is not a canvas.

## Drawing a lot

A canvas with thousands of shapes on it — a whiteboard, a diagram, a map of points — is judged on a slower machine than
yours: sixty frames a second here says nothing about a four-year-old laptop. What keeps one fast is doing work in
proportion to what CHANGED, not to what is there:

- **Two layers.** Paint what stands still on one canvas and leave it; clear and draw the one over it every frame, with
  only what moves: the cursor, the selection, what is being dragged.
- **Repaint the part that changed.** Something added, edited or removed repaints the area it was and is in, clipped,
  with whatever reaches into it — not the whole board. A pan moves the picture already painted by whole device pixels
  and paints the edges it uncovers.
- **Draw a dragged group once.** Everything picked up moves by the same amount at every step: draw it to a canvas of its
  own when the drag begins and copy that into place after.
- **Cache per object, not per frame.** Treat elements as immutable and key what is derived from one — its bounds, its
  shape, a resolved connector — on the object itself (a `WeakMap`), so nothing is worked out twice for the same thing.
- **Hand the space outcomes, not motion.** A stroke finished, a selection changed: a trigger each. Firing one at every
  pointer move runs a flow and renders the page at every pointer move.
- **Measure with a bench, throttled.** A script that drives the real thing in a browser with the CPU slowed
  (`Emulation.setCPUThrottlingRate`) and reports script time per frame, not only frames per second — and a test that
  counts WORK (full repaints, strokes drawn during a drag), which holds on any machine where a timing does not.

Pizarra, the collaborative whiteboard on the platform (`pizarra.plitzi.app`), does all of it on a board of thousands
of elements.
