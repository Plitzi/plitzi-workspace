import { defineElement, styles } from '@plitzi/sdk-authoring';

import copyDeclaration from '../plugins/CopyText/declaration.ts';

import type { CopyTextAttributes } from '../plugins/CopyText/declaration.ts';

/** A line to copy — a command, a message — as the invite panel and the agents guide show them. */
export const copyText = defineElement<CopyTextAttributes>(copyDeclaration);

export const COPY_DECLARATION = copyDeclaration;

/** The card's colours, and — in `css.ts` — where its `--copy-*` are pointed at the space's tokens. */
/** The field and the button in the space's colours. */
export const copyClass = styles('copyText', {
  color: 'var(--ink)',
  '--copy-field': 'var(--surface-2)',
  '--copy-accent': 'var(--accent)',
  '--copy-on-accent': 'var(--on-accent)'
});
