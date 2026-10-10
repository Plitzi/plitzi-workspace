import { describe, expect, it } from 'vitest';

import { scopeSpaceCss } from './scopeSpaceCss';

describe('scopeSpaceCss', () => {
  it('keeps the rules to the root the stylesheet hangs from', () => {
    expect(scopeSpaceCss('.card{color:red}')).toBe('@scope{.card{color:red}}');
  });

  it('writes the palette on that root instead of the document', () => {
    const palette =
      ':root{--bg:#fff}@media (prefers-color-scheme: dark){:root:not(.light){--bg:#000}}:root.dark, .dark{--bg:#000}';

    expect(scopeSpaceCss(palette)).toBe(
      '@scope{:scope{--bg:#fff}@media (prefers-color-scheme: dark){:scope:not(.light){--bg:#000}}:scope.dark, .dark{--bg:#000}}'
    );
  });
});
