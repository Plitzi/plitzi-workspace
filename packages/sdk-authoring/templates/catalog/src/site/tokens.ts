/**
 * Every colour the site uses, with a value for each theme. Elements say `t.<name>` — `var(--name)` — so the palette
 * changes here and nowhere else, and a name that is not here is a type error.
 */
import { tokens } from '@plitzi/sdk-authoring';

import type { SpaceSpec } from '@plitzi/sdk-authoring';

export const variables = {
  color: {
    background: { light: '#fbfbfd', dark: '#0b0b0f', default: '#fbfbfd' },
    surface: { light: '#ffffff', dark: '#15151b', default: '#ffffff' },
    foreground: { light: '#17171c', dark: '#f4f4f5', default: '#17171c' },
    muted: { light: '#5f5f6e', dark: '#a1a1aa', default: '#5f5f6e' },
    border: { light: '#e6e6ee', dark: '#2a2a32', default: '#e6e6ee' },
    primary: { light: '#4f46e5', dark: '#818cf8', default: '#4f46e5' },
    'on-primary': { light: '#ffffff', dark: '#0b0b0f', default: '#ffffff' }
  }
} satisfies SpaceSpec['variables'];

export const t = tokens(variables);
