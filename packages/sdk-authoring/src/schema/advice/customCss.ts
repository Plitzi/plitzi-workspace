/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { splitNotificationsCss } from '@plitzi/sdk-shared/style/notifications';

import { declaredClasses } from './declaredClasses';
import { foldCustomCss } from '../../decompile/customCss';

import type { Suggestion } from './types';
import type { Schema, Style } from '@plitzi/sdk-shared';

/**
 * What a space's `customCss` says that something else says better.
 *
 * - A rule a class can hold — `.card:hover`, `.card .icon`, `.link::after`, one under `@media (prefers-reduced-motion:
 *   reduce)` — read by the same fold the export makes, so this suggests
 *   exactly what an export would do with it.
 * - What the SDK already does for every space: the stills for a visitor who asked for less motion, the theme toggle
 *   showing the icon of the scheme in use.
 * - The toasts dressed by hand, which `notifications` dresses.
 */

/** The universal reset a space writes for `prefers-reduced-motion`, which the SDK's base layer makes already. */
const MOTION_RESET =
  /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[^@]*?\*[^{]*\{[^}]*(?:animation|transition)-duration/;

/** Showing or hiding an icon of the theme toggle — what the SDK's base layer does by default. Sizing one is not. */
const THEME_ICONS = /\.plitzi-component__theme-toggle\s*\[data-theme-icon[^{]*\{[^}]*display\s*:/;

/** What a field of `notifications` says of the toast or a part inside it, written as a rule on the library's class. */
const TOAST_RULES = [
  /\.Toastify__toast\s*\{[^}]*?(?<![\w-])(?:font-family|font-size|font-weight|line-height|min-height|border|box-shadow|padding)\s*:/,
  /\.Toastify__toast-icon\s*\{[^}]*?(?<![\w-])(?:width|margin-inline-end)\s*:/,
  /\.Toastify__close-button\s*\{[^}]*?(?<![\w-])(?:color|opacity)\s*:/,
  /\.Toastify__progress-bar(?:--wrp)?\s*\{[^}]*?(?<![\w-])height\s*:/
];

export const suggestCustomCss = (schema: Schema, style: Style): Suggestion[] => {
  const customCss = schema.settings.customCss;
  if (!customCss.trim()) {
    return [];
  }

  const suggestions: Suggestion[] = [];
  const classes = declaredClasses(style);
  const { folded } = foldCustomCss(customCss, name => classes.has(name));
  if (folded.length > 0) {
    const targets = folded.flatMap(rule =>
      rule.targets.map(target => {
        const parts = [
          ...(target.state ? [`its \`${target.state}\` state`] : []),
          ...(target.pseudo ? [`its \`${target.pseudo}\``] : []),
          ...(target.condition ? [`under \`${target.condition}\``] : [])
        ];
        const where = target.ancestor
          ? `inside \`${target.ancestor.className}\`${target.ancestor.state ? `:${target.ancestor.state}` : ''}`
          : parts.join(', ') || 'itself';

        return `\`${target.className}\` (${where})`;
      })
    );
    suggestions.push({
      code: 'custom-css-class',
      elementIds: [],
      saves: 0,
      message:
        `${String(folded.length)} rule${folded.length === 1 ? '' : 's'} in \`customCss\` ${folded.length === 1 ? 'is' : 'are'} ` +
        `a class's own: ${targets.slice(0, 4).join(', ')}${targets.length > 4 ? ', …' : ''}. Write ${folded.length === 1 ? 'it' : 'them'} on ` +
        'the class — `states: { hover: { … } }`, `ancestors: { [card.name]: { states: { hover: { … } } } }`, ' +
        "`pseudos: { after: { content: '\"→\"' } }`, `conditions: { 'motion-reduce': { … } }` — where the style editor " +
        'shows it and a breakpoint can change it.'
    });
  }

  const sdkDefaults = [
    ...(MOTION_RESET.test(customCss)
      ? ['the reset for `prefers-reduced-motion` (every animation and transition is stilled for whoever asks)']
      : []),
    ...(THEME_ICONS.test(customCss) ? ['the theme toggle showing one icon (the one of the scheme in use)'] : [])
  ];
  if (sdkDefaults.length > 0) {
    suggestions.push({
      code: 'custom-css-sdk-default',
      elementIds: [],
      saves: 0,
      message:
        `\`customCss\` repeats what the SDK already does on every space: ${sdkDefaults.join('; ')}. Remove it — keep ` +
        'only what goes beyond it, like a hover that moves a card (`transform: none` under reduced motion).'
    });
  }

  // Read past the rules `notifications` itself writes at the end, which say those very fields.
  const ownCss = splitNotificationsCss(customCss).customCss;
  if (TOAST_RULES.some(rule => rule.test(ownCss))) {
    suggestions.push({
      code: 'custom-css-notifications',
      elementIds: [],
      saves: 0,
      message:
        'The toasts are dressed by `.Toastify__*` rules in `customCss`. Their type, edge, depth, room and height, and ' +
        "their icon, close button and progress bar, are fields of the space's `notifications` — `notifications: " +
        "{ font: 'var(--font-sans)', fontWeight: '500', minHeight: '0px', iconSize: '18px', closeColor: " +
        "'var(--muted)', progressHeight: '2px' }` — beside their colours; keep in `customCss` only what those do " +
        'not say.'
    });
  }

  return suggestions;
};
