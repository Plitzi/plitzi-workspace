import { AuthoringError } from './codes';

/** One element `authorSpace` could not write: where to find it, and why. */
export type SpaceRefusal = {
  /** The nearest named element and the steps from it — `"store-footer" › container[1]`. Empty for the space itself. */
  place: string;
  /** The line of the author's own code that wrote it — `src/site/layout.ts:417` — when a factory recorded one. */
  at?: string;
  /** What `authoring-errors.md` files it under — a code of `AUTHORING_CODES`, or a structural one of `validateSchema`. */
  code?: string;
  message: string;
};

/** What a thrown problem says as a refusal: its code and sentence when it is an `AuthoringError`, its message otherwise. */
export const refusalOf = (error: unknown): Pick<SpaceRefusal, 'code' | 'message'> => {
  if (error instanceof AuthoringError) {
    return { code: error.code, message: error.reason };
  }

  return { message: error instanceof Error ? error.message : String(error) };
};

/**
 * Everything `authorSpace` refused in one run, rather than the first thing: an author fixes the lot in one pass instead
 * of discovering them one corrected run at a time. `refusals` holds them as data, for a tool that prints its own.
 */
export class SpaceRefusedError extends Error {
  readonly refusals: readonly SpaceRefusal[];

  /**
   * `linted: false` when elements had to be left out: the documents are not whole, so the space's other checks — the
   * ones that read what the elements mean — wait for these to be fixed rather than report what is merely missing.
   */
  constructor(space: string, refusals: readonly SpaceRefusal[], { linted = true }: { linted?: boolean } = {}) {
    const count = refusals.length === 1 ? 'one problem' : `${refusals.length} problems`;
    const list = refusals
      .map((refusal, index) => {
        const where = [refusal.at, refusal.place].filter(Boolean).join(' · ');
        const message = `${refusal.code ? `[${refusal.code}] ` : ''}${refusal.message}`.replaceAll('\n', '\n   ');

        return `${index + 1}. ${where ? `${where}\n   ` : ''}${message}`;
      })
      .join('\n\n');
    const pending = linted ? '' : '\n\nThe space’s other checks run once these are fixed.';
    const codes = refusals.some(refusal => refusal.code)
      ? '\n\nEach [code] is a row of the plitzi-authoring skill’s reference/authoring-errors.md.'
      : '';
    super(`Space "${space}" was not written — ${count}:\n\n${list}${pending}${codes}`);
    this.name = 'SpaceRefusedError';
    this.refusals = refusals;
  }
}
