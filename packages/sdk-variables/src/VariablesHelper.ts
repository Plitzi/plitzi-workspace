const isColor = (style: CSSStyleDeclaration, color: string) => {
  style.color = '';
  style.color = color;

  return style.color !== '';
};

export const variablesToCss = (variables?: Record<string, string>) => {
  const styleDOM = typeof document !== 'undefined' && document.createElement('span').style;
  if (!variables) {
    return '';
  }

  return Object.keys(variables)
    .filter(key => typeof variables[key] === 'string' || typeof variables[key] === 'number')
    .map(key => {
      const value = variables[key];
      if (styleDOM && isColor(styleDOM, value)) {
        return `--${key}:${value};`;
      }

      return `--${key}:"${value}";`;
    })
    .join('\n');
};
