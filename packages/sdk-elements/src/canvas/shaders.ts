/** A shader that did not compile, or a program that did not link: what WebGL said, and which stage said it. */
export class ShaderError extends Error {
  readonly stage: 'vertex' | 'fragment' | 'link';
  readonly log: string;

  constructor(stage: ShaderError['stage'], log: string) {
    super(`${stage === 'link' ? 'program failed to link' : `${stage} shader failed`}: ${log.trim() || 'no log given'}`);
    this.name = 'ShaderError';
    this.stage = stage;
    this.log = log;
  }
}

const compile = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  stage: 'vertex' | 'fragment',
  source: string
): WebGLShader => {
  const shader = gl.createShader(stage === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
  if (!shader) {
    throw new ShaderError(stage, 'the context made no shader (it is lost)');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    const log = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new ShaderError(stage, log);
  }

  return shader;
};

/**
 * A vertex and a fragment shader, compiled and linked into a program — or a `ShaderError` carrying what the driver
 * said. WebGL itself fails a shader in silence: `compileShader` returns nothing, the program draws nothing, and the
 * canvas stays empty with no word of why (`rgb(196, 214, 255)` — integers, where GLSL ES 1.0 wants `196.0`). Thrown
 * inside `useCanvas`, the error is printed with the element it belongs to and the loop stops.
 */
export const createShaderProgram = (
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  { vertex, fragment }: { vertex: string; fragment: string }
): WebGLProgram => {
  const vertexShader = compile(gl, 'vertex', vertex);
  const fragmentShader = compile(gl, 'fragment', fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  // Linked, the program holds what it needs: the shaders themselves are only kept alive by it.
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    const log = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new ShaderError('link', log);
  }

  return program;
};
