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
