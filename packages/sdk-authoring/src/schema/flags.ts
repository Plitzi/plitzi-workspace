import { isFlagName } from '@plitzi/sdk-shared/flags';

import { AuthoringError } from './codes';

import type { ElementFlagGate } from '@plitzi/sdk-shared';

/**
 * The gate an element's or a page's `flag` writes: `'newCheckout'` while the flag is on, `'!newCheckout'` while it is
 * off. Whether the flag is DECLARED is `lintSpace`'s to say, with the declared ones to choose from; a value that names
 * no flag at all is refused here, where it was written.
 */
export const flagGateOf = (flag: unknown, where: string): ElementFlagGate | undefined => {
  if (flag === undefined) {
    return undefined;
  }

  const text = typeof flag === 'string' ? flag : '';
  const is = !text.startsWith('!');
  const name = is ? text : text.slice(1);
  if (!isFlagName(name)) {
    throw new AuthoringError(
      'flag-gate',
      `${where}: \`flag\` is ${JSON.stringify(flag)}. It names a flag the space declares in \`flags\` — \`flag: 'newCheckout'\` exists while it is on — or, with a leading \`!\`, one that has to be off: \`flag: '!newCheckout'\`.`
    );
  }

  return { name, is };
};

/** The other way round, for a document read back into a spec. */
export const flagSpecOf = (gate: ElementFlagGate): string => (gate.is ? gate.name : `!${gate.name}`);
