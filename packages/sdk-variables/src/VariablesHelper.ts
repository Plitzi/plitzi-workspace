import type { StyleVariables } from '@plitzi/sdk-shared';

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const rgbColorRegex = /^rgba?\(\s*(\d{1,3}%?\s*,\s*){2,3}\d{1,3}%?\s*\)$/;
const hslColorRegex = /^hsla?\(\s*\d{1,3}(deg|rad|turn)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(\s*,\s*(0|0?\.\d+|1))?\s*\)$/;

const cssColorNames = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'cyan',
  'magenta',
  'orange',
  'purple',
  'brown',
  'pink',
  'gray',
  'lime',
  'teal',
  'navy',
  'silver',
  'maroon',
  'olive',
  'aqua',
  'fuchsia'
]);

const isColor = (value: string): boolean => {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const v = value.trim().toLowerCase();

  return hexColorRegex.test(v) || rgbColorRegex.test(v) || hslColorRegex.test(v) || cssColorNames.has(v);
};

export const schemaVariablesToCss = (variables?: Record<string, string>) => {
  if (!variables) {
    return '';
  }

  return Object.keys(variables)
    .filter(key => typeof variables[key] === 'string' || typeof variables[key] === 'number')
    .map(key => {
      const value = variables[key];
      if (isColor(value)) {
        return `--${key}:${value};`;
      }

      return `--${key}:"${value}";`;
    })
    .join('\n');
};

export const styleVariablesToCss = (
  variables: Partial<StyleVariables>,
  name: string = ':root',
  tabIndentSpace: number = 2,
  includeRoot: boolean = true
): string => {
  const root: string[] = [];
  const light: string[] = [];
  const dark: string[] = [];

  const spacing = ' '.repeat(tabIndentSpace);
  const spacingInsideMedia = ' '.repeat(tabIndentSpace * 2);
  for (const [, group] of Object.entries(variables)) {
    for (const [name, value] of Object.entries(group)) {
      const cssVar = `--${name}`;

      if (typeof value === 'object') {
        // Only the sides that were actually given. A missing one used to be written out as the literal text
        // `undefined`, and a custom property accepts almost any token sequence — so instead of being ignored it
        // OVERRODE the good value, and everything reading that var computed to nothing. A theme value with only
        // `light`/`dark` must leave :root untouched, and one with only `default` must not be undone per scheme.
        if (value.default !== undefined) {
          root.push(`${spacingInsideMedia}${cssVar}: ${value.default};`);
        }

        if (value.light !== undefined) {
          light.push(`${spacingInsideMedia}${cssVar}: ${value.light};`);
        }

        if (value.dark !== undefined) {
          dark.push(`${spacingInsideMedia}${cssVar}: ${value.dark};`);
        }
      } else {
        root.push(`${spacingInsideMedia}${cssVar}: ${value};`);
      }
    }
  }

  let css = '';
  if (includeRoot) {
    css = `${name} {\n${root.join('\n')}\n}`;
  }

  /**
   * Two ways a scheme is decided, and they have to agree on which one wins.
   *
   * The operating system says one thing and the visitor may say another — a page with a light/dark switch on it —
   * so the media queries answer only while nothing has been chosen (`:not(.light)` / `:not(.dark)` on the root),
   * and the chosen class answers last. A space with no switch never sees a class and behaves exactly as before.
   */
  const scoped = (mode: 'light' | 'dark') => (name === ':root' ? `${name}.${mode}` : `.${mode} ${name}`);
  const unless = (mode: 'light' | 'dark') =>
    name === ':root' ? `${name}:not(.${mode})` : `:root:not(.${mode}) ${name}`;

  if (light.length) {
    css += `\n\n@media (prefers-color-scheme: light) {\n${spacing}${unless('dark')} {\n${light.join('\n')}\n  }\n}`;
  }

  if (dark.length) {
    css += `\n\n@media (prefers-color-scheme: dark) {\n${spacing}${unless('light')} {\n${dark.join('\n')}\n  }\n}`;
  }

  if (light.length) {
    css += `\n\n${scoped('light')} {\n${light.join('\n')}\n}`;
  }

  if (dark.length) {
    css += `\n\n${scoped('dark')} {\n${dark.join('\n')}\n}`;
  }

  return css;
};

export const styleSelectorVariablesToCss = (
  variables: Partial<StyleVariables>,
  name: string,
  tabIndentSpace: number = 2,
  includeRoot: boolean = true
) => {
  return styleVariablesToCss(variables, name, tabIndentSpace, includeRoot);
};
