import { readFileSync } from 'node:fs';
import path from 'node:path';

import { require } from '../shared';

/** The SDK's stylesheets, as a widget gets them.
 *
 *  Everything the page shell inlines is paid for by EVERY widget: the host loads the ui:// page into a fresh
 *  sandboxed iframe and parses it whole before anything paints, which is the "Rendering…" the user waits through. So
 *  the shell takes only `plitzi-sdk.css`, and Font Awesome — its rules in `plitzi-sdk-icons.css`, its fonts files
 *  beside it — travels in the tool result of the renders that actually draw an icon (see tools/render.ts). A widget
 *  without icons never downloads a glyph. */

const sdkDist = (): string => path.dirname(require.resolve('@plitzi/plitzi-sdk'));

const FONT_URL = /url\((webfonts\/[\w.-]+\.woff2)\)/g;

/** The icon sheet with each font it names inlined: the widget's sandbox reaches no origin to fetch one from. */
export const inlineIconFonts = (css: string, readFont: (file: string) => Buffer): string =>
  css.replace(FONT_URL, (_match, file: string) => `url(data:font/woff2;base64,${readFont(file).toString('base64')})`);

// Read once per process: every render asks for one or the other.
let base: string | undefined;
let icons: string | undefined;

/** What the page shell inlines. */
export const widgetCss = (): string => (base ??= readFileSync(path.join(sdkDist(), 'plitzi-sdk.css'), 'utf-8'));

/** Font Awesome, fonts and all, for the renders that draw an icon. */
export const iconFontCss = (): string =>
  (icons ??= inlineIconFonts(readFileSync(path.join(sdkDist(), 'plitzi-sdk-icons.css'), 'utf-8'), file =>
    readFileSync(path.join(sdkDist(), file))
  ));
