import { describe, expect, it } from 'vitest';

import { OUTLINE_LIMIT, outlineOfSnapshot, outlineOfTree, unnamedControls } from './accessibilityOutline';

describe('mcp/accessibilityOutline', () => {
  it('writes the tree Puppeteer answers as the outline Playwright writes, structure left out', () => {
    const outline = outlineOfTree({
      role: 'RootWebArea',
      name: 'Pricing',
      children: [
        {
          role: 'generic',
          children: [
            { role: 'heading', name: 'Plans', level: 1, children: [{ role: 'StaticText', name: 'Plans' }] },
            { role: 'button', name: 'Yearly', pressed: true },
            { role: 'checkbox', name: 'Remember me', checked: false },
            { role: 'textbox', name: 'Email', value: 'ada@example.com', invalid: 'true' },
            { role: 'StaticText', name: 'Billed   once' }
          ]
        }
      ]
    });

    expect(outline).toBe(
      [
        '- RootWebArea "Pricing"',
        '  - heading "Plans" [level=1]',
        '  - button "Yearly" [pressed]',
        '  - checkbox "Remember me"',
        '  - textbox "Email" [invalid]: "ada@example.com"',
        '  - text: "Billed once"'
      ].join('\n')
    );
  });

  it('finds the controls and pictures nothing names, in either outline', () => {
    const fromTree = outlineOfTree({
      role: 'RootWebArea',
      children: [
        { role: 'button', name: '' },
        { role: 'link', name: 'Docs' },
        { role: 'image', name: '' },
        { role: 'combobox', name: '', expanded: false }
      ]
    });
    const fromPlaywright = outlineOfSnapshot(
      ['- navigation "Main":', '  - link:', '    - /url: /home', '  - button [pressed]', '- button "Close"'].join('\n')
    );

    expect(unnamedControls(fromTree)).toEqual([
      { role: 'button', line: 1 },
      { role: 'img', line: 3 },
      { role: 'combobox', line: 4 }
    ]);
    expect(unnamedControls(fromPlaywright)).toEqual([
      { role: 'link', line: 2 },
      { role: 'button', line: 4 }
    ]);
  });

  it('cuts a very long outline and says where', () => {
    const outline = outlineOfSnapshot('- text: "x"\n'.repeat(OUTLINE_LIMIT));

    expect(outline.length).toBeLessThan(OUTLINE_LIMIT + 200);
    expect(outline).toContain(`cut at ${OUTLINE_LIMIT} characters`);
  });
});
