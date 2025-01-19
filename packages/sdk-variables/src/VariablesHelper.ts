export const variablesToCss = (variables?: { [key: string]: string }) => {
  if (!variables) {
    return '';
  }

  const cssVariables = Object.keys(variables)
    .filter(key => typeof variables[key] === 'string' || typeof variables[key] === 'number')
    .map(key => `--${key}:${variables[key]};`, '')
    .join('\n');

  return cssVariables;
};
