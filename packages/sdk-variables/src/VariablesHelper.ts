export const variablesToCss = (variables?: Record<string, string>) => {
  if (!variables) {
    return '';
  }

  return Object.keys(variables)
    .filter(key => typeof variables[key] === 'string' || typeof variables[key] === 'number')
    .map(key => `--${key}:"${variables[key]}";`, '')
    .join('\n');
};
