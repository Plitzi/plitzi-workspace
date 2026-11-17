import { describe, expect, it } from 'vitest';

import { codeOf } from './checkExceptions.mjs';

const anys = text => codeOf(text).match(/(?::\s*any\b|<any>|\bas any\b|\bany\[\]|Array<any>)/g)?.length ?? 0;

describe('codeOf', () => {
  it('keeps what a type is written in', () => {
    expect(anys('const a: any = 1;\nconst b = c as any;\nconst d: Array<any> = [];')).toBe(3);
  });

  // A label's words are prose: 'The page scrolls as any page does.' was counted as an `as any` and failed the ratchet.
  it('leaves out what a comment or a string says', () => {
    expect(
      anys("// the other way: any difference\n/* x: any */\nconst help = 'The page scrolls as any page does.';")
    ).toBe(0);
    expect(anys('const a = "as any one"; const b = `as any other`;')).toBe(0);
  });

  it('counts what is code inside a template, and keeps an address in a string', () => {
    expect(anys('const a = `${(b as any).c}`;')).toBe(1);
    expect(anys("const url = 'https://example.com'; const x: any = 1;")).toBe(1);
  });

  // By code points, each emoji moved every blank after it one place on: the code after the icons was blanked instead.
  it('blanks where the parser says, an emoji before it or not', () => {
    const icons = "const icons = '🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀';";
    const text = `${icons}\nconst label = 'read as any';\nconst a: any = 1;`;

    expect(codeOf(text)).toContain('\nconst a: any = 1;');
    expect(anys(text)).toBe(1);
  });

  // Read as TSX, a `.ts` file's generic arrow `<D, A>(…)` was a tag, and its body blanked as the tag's text.
  it('reads a .ts file as TypeScript, generics and all', () => {
    const generic = 'export const make = <D, A>(value: D): A => {\n  return value as unknown as A;\n};';

    expect(codeOf(generic, 'declare.ts').match(/\bas unknown as\b/g)).toHaveLength(1);
  });
});
