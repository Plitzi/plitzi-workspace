import { renderToString } from 'react-dom/server';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import { describe, expect, it } from 'vitest';

import { highlightedCode, SyntaxHighlighter } from './syntaxHighlighter';

const options = { code: 'const a = 1;\nconst b = a;', language: 'ts', wrapLines: true, showLineNumbers: true };

describe('highlightedCode', () => {
  // Called as a function, the light build must stay one with no hooks: drawn alike either way.
  it('draws a block exactly as the highlighter does as a component', () => {
    expect(renderToString(highlightedCode(options))).toBe(
      renderToString(
        <SyntaxHighlighter PreTag="div" language="ts" style={vscDarkPlus} wrapLines showLineNumbers>
          {options.code}
        </SyntaxHighlighter>
      )
    );
  });

  it('highlights a block once, and another text or another way of drawing it anew', () => {
    const block = highlightedCode(options);

    expect(highlightedCode({ ...options })).toBe(block);
    expect(highlightedCode({ ...options, code: 'let c = 2;' })).not.toBe(block);
    expect(highlightedCode({ ...options, showLineNumbers: false })).not.toBe(block);
  });
});
