export const variablesToCss = variables => {
  if (!variables) {
    return '';
  }

  const cssVariables = Object.keys(variables)
    .filter(key => typeof variables[key] === 'string' || typeof variables[key] === 'number')
    .map(key => `--${key}:${variables[key]};`, '')
    .join('\n');

  return cssVariables;
};
