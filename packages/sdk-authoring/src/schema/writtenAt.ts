/**
 * Where in the author's own code an element was written — `src/site/layout.ts:417` — for a refusal to point at.
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

const FRAME = /\(?((?:file:\/\/)?[^\s()]+?):(\d+):\d+\)?$/;

export const markWrittenAt = <T extends object>(spec: T): T => {
  if (!isProduction()) {
    Object.defineProperty(spec, WRITTEN_AT, { value: new Error(), enumerable: false });
  }

  return spec;
};

/** The first frame of the author's own code that wrote `spec`, relative to the working directory; or nothing. */
export const writtenAt = (spec: unknown): string | undefined => {
  const marker: unknown = typeof spec === 'object' && spec !== null ? Reflect.get(spec, WRITTEN_AT) : undefined;
  if (!(marker instanceof Error) || !marker.stack) {
    return undefined;
  }

  const cwd = typeof process !== 'undefined' ? `${process.cwd()}/` : '';
  for (const line of marker.stack.split('\n').slice(1)) {
    const match = FRAME.exec(line.trim());
    if (!match) {
      continue;
    }

    const file = match[1].replace(/^file:\/\//, '');
    if (!isOwnFrame(file)) {
      return `${cwd && file.startsWith(cwd) ? file.slice(cwd.length) : file}:${match[2]}`;
    }
  }

  return undefined;
};
