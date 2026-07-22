import type { LexResult } from './types';

export const lex = (template: string): LexResult => {
  const tokens: LexResult['tokens'] = [];
  let pos = 0;

  while (pos < template.length) {
    const nextOpen = template.indexOf('{{', pos);
    const nextTag = template.indexOf('{%', pos);

    let nextPos: number;
    let isTag: boolean;
    if (nextOpen === -1 && nextTag === -1) {
      break;
    } else if (nextOpen === -1) {
      nextPos = nextTag;
      isTag = true;
    } else if (nextTag === -1) {
      nextPos = nextOpen;
      isTag = false;
    } else if (nextOpen < nextTag) {
      nextPos = nextOpen;
      isTag = false;
    } else {
      nextPos = nextTag;
      isTag = true;
    }

    if (nextPos > pos) {
      tokens.push({ type: 'text', value: template.slice(pos, nextPos) });
    }

    if (!isTag && template.charCodeAt(nextPos + 2) === 123) {
      const closePos = template.indexOf('}}}', nextPos + 3);
      if (closePos === -1) {
        return { tokens, error: 'Unclosed triple-brace token' };
      }
      tokens.push({ type: 'variable', content: template.slice(nextPos + 3, closePos), raw: true });
      pos = closePos + 3;
    } else if (!isTag) {
      const closePos = template.indexOf('}}', nextPos + 2);
      if (closePos === -1) {
        return { tokens, error: 'Unclosed double-brace token' };
      }
      tokens.push({ type: 'variable', content: template.slice(nextPos + 2, closePos), raw: false });
      pos = closePos + 2;
    } else {
      const closePos = template.indexOf('%}', nextPos + 2);
      if (closePos === -1) {
        return { tokens, error: 'Unclosed tag' };
      }
      tokens.push({ type: 'tag', content: template.slice(nextPos + 2, closePos) });
      pos = closePos + 2;
    }
  }

  if (pos < template.length) {
    tokens.push({ type: 'text', value: template.slice(pos) });
  }

  return { tokens, error: null };
};
