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

export const styleVariablesToCss = (variables: Partial<StyleVariables>): string => {
  const root: string[] = [];
  const light: string[] = [];
  const dark: string[] = [];

  for (const [, group] of Object.entries(variables)) {
    for (const [name, value] of Object.entries(group)) {
      const cssVar = `--${name}`;

      if (typeof value === 'object') {
        root.push(`  ${cssVar}: ${value.default};`);
        light.push(`  ${cssVar}: ${value.light};`);
        dark.push(`  ${cssVar}: ${value.dark};`);
      } else {
        root.push(`  ${cssVar}: ${value};`);
      }
    }
  }

  let css = `:root {\n${root.join('\n')}\n}`;

  if (light.length) {
    css += `\n\n@media (prefers-color-scheme: light) {\n  :root {\n${light.join('\n')}\n  }\n}`;
  }

  if (dark.length) {
    css += `\n\n@media (prefers-color-scheme: dark) {\n  :root {\n${dark.join('\n')}\n  }\n}`;
  }

  return css;
};
