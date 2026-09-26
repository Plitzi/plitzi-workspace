import { defineElement, styles } from '@plitzi/sdk-authoring';

import copyDeclaration from '../plugins/CopyText/declaration.ts';

import type { CopyTextAttributes } from '../plugins/CopyText/declaration.ts';

/** A line to copy — a command, a message — as the invite panel and the agents guide show them. */
export const copyText = defineElement<CopyTextAttributes>(copyDeclaration);

export const COPY_DECLARATION = copyDeclaration;

/** The card's colours, and — in `css.ts` — where its `--copy-*` are pointed at the space's tokens. */
export const copyClass = styles('copyText', { color: 'var(--ink)' });
