/**
 * Where in the author's own code an element was written — `src/space/layout.ts:417` — for a refusal to point at.
 *
 * A factory (`container(…)`, `text(…)`) keeps an `Error` on the spec it returns, under a symbol nothing enumerates: it
 * does not travel with the spec through a spread, a clone or `JSON.stringify`, and the stack it carries is only
 * formatted when a refusal reads it. Off in production, where nobody reads a refusal at a terminal.
 */
const WRITTEN_AT = Symbol('plitzi.writtenAt');

const isProduction = (): boolean => typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

/**
 * This package's own folder, from where this module is: `…/sdk-authoring/` whether it runs from `dist` or `src`, so a
 * project that merely has "sdk-authoring" somewhere in its path is not mistaken for it.
 */
const OWN_ROOT = ((): string => {
  try {
    const file = new URL(import.meta.url).pathname;
    const at = file.lastIndexOf('/sdk-authoring/');

    return at === -1 ? file.slice(0, file.lastIndexOf('/') + 1) : file.slice(0, at + '/sdk-authoring/'.length);
  } catch {
    return '';
  }
})();

/** A frame of this package or of a dependency: not where the author wrote anything. */
const isOwnFrame = (file: string): boolean =>
  file.startsWith('node:') || file.includes('/node_modules/') || (OWN_ROOT !== '' && file.startsWith(OWN_ROOT));

/**
 * The working directory, with its trailing slash — or nothing where there is none to ask: a browser bundle may carry a
 * `process` shim (Vite's has `env` and no `cwd`), so its presence alone says nothing.
 */
const workingDirectory = (): string => {
  const cwd: unknown = typeof process === 'undefined' ? undefined : Reflect.get(process, 'cwd');

  return typeof cwd === 'function' ? `${String(Reflect.apply(cwd, process, []))}/` : '';
};

const FRAME = /\(?((?:file:\/\/)?[^\s()]+?):(\d+):(\d+)\)?$/;

export const markWrittenAt = <T extends object>(spec: T): T => {
  if (!isProduction()) {
    Object.defineProperty(spec, WRITTEN_AT, { value: new Error(), enumerable: false });
  }

  return spec;
};

/** Where a call is, exactly: the file, its line and the column its function's name starts at, from 1. */
export interface WrittenPosition {
  /** Relative to the working directory when it is under it. */
  file: string;
  line: number;
  column: number;
}

/**
 * The call in the author's own code that wrote `spec` — the factory's name at that line and column, which tells it
 * apart from another call on the same line. What a fix edits the source at.
 */
export const writtenAtPosition = (spec: unknown): WrittenPosition | undefined => {
  const marker: unknown = typeof spec === 'object' && spec !== null ? Reflect.get(spec, WRITTEN_AT) : undefined;
  if (!(marker instanceof Error) || !marker.stack) {
    return undefined;
  }

  const cwd = workingDirectory();
  for (const line of marker.stack.split('\n').slice(1)) {
    const match = FRAME.exec(line.trim());
    if (!match) {
      continue;
    }

    const file = match[1].replace(/^file:\/\//, '');
    if (!isOwnFrame(file)) {
      return {
        file: cwd && file.startsWith(cwd) ? file.slice(cwd.length) : file,
        line: Number(match[2]),
        column: Number(match[3])
      };
    }
  }

  return undefined;
};

/** The first frame of the author's own code that wrote `spec`, relative to the working directory; or nothing. */
export const writtenAt = (spec: unknown): string | undefined => {
  const position = writtenAtPosition(spec);

  return position ? `${position.file}:${String(position.line)}` : undefined;
};
