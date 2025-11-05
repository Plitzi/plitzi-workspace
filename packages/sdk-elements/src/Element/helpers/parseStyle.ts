import type { CSSProperties } from 'react';

const parseStyle = (style: string | CSSProperties = ''): CSSProperties | undefined => {
  if (!style) {
    return undefined;
  }

  if (typeof style === 'object') {
    return style;
  }

  return Object.fromEntries(
    style
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const [key, value] = s.split(':').map(x => x.trim());
        const camelKey = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

        return [camelKey, value];
      })
  );
};

export default parseStyle;
