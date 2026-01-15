import { describe, it, expect } from 'vitest';

import processSelectorAttributes, { processCssString } from './processSelectorAttributes';

describe('processSelectorAttributes.processCssString', () => {
  it('generates a secondary variable only if concatenation breaks CSS', () => {
    let result = processCssString('background-image', 'url("var(--webUrl)/assets/img/bg.png")');
    expect(result).toEqual({
      value: 'background-image:url(var(--webUrl-parsed));',
      variables: ['--webUrl-parsed:var(--webUrl)+"/assets/img/bg.png";']
    });

    result = processCssString('background-image', 'url("var(--webUrl)/assets/img/bg(1).png")');
    expect(result).toEqual({
      value: 'background-image:url(var(--webUrl-parsed));',
      variables: ['--webUrl-parsed:var(--webUrl)+"/assets/img/bg(1).png";']
    });

    result = processCssString('background-image', 'linear-gradient(black, white);');
    expect(result).toEqual({ value: 'background-image:linear-gradient(black, white);', variables: [] });

    result = processCssString('background-image', 'linear-gradient(var(--color1), white);');
    expect(result).toEqual({ value: 'background-image:linear-gradient(var(--color1), white);', variables: [] });

    result = processCssString(
      'background-image',
      'radial-gradient(circle, transparent 45%, black 48%), radial-gradient(ellipse farthest-corner, #fc1c14 20%, #cf15cf 80%);'
    );
    expect(result).toEqual({
      value:
        'background-image:radial-gradient(circle, transparent 45%, black 48%),radial-gradient(ellipse farthest-corner, #fc1c14 20%, #cf15cf 80%);',
      variables: []
    });

    result = processCssString(
      'background-image',
      'radial-gradient(circle, transparent 45%, var(--color1) 48%), radial-gradient(ellipse farthest-corner, var(--color2) 20%, #cf15cf 80%);'
    );
    expect(result).toEqual({
      value:
        'background-image:radial-gradient(circle,transparent 45%,var(--color1) 48%),radial-gradient(ellipse farthest-corner,var(--color2) 20%, #cf15cf 80%);',
      variables: []
    });

    result = processCssString(
      'background-image',
      'url("var(--webUrl)/assets/img/bg.png"), url("var(--webUrl)/assets/img/bg.png");'
    );
    expect(result).toEqual({
      value: 'background-image:url(var(--webUrl-parsed)),url(var(--webUrl-parsed));',
      variables: ['--webUrl-parsed:var(--webUrl)+"/assets/img/bg.png";']
    });

    result = processCssString(
      'background-image',
      'url("var(--webUrl)/assets/img/bg1.png"), url("var(--webUrl)/assets/img/bg2.png");'
    );
    expect(result).toEqual({
      value: 'background-image:url(var(--webUrl-parsed)),url(var(--webUrl-parsed-1));',
      variables: [
        '--webUrl-parsed:var(--webUrl)+"/assets/img/bg1.png";',
        '--webUrl-parsed-1:var(--webUrl)+"/assets/img/bg2.png";'
      ]
    });
  });

  it('leaves valid var values intact', () => {
    const result = processCssString('color', 'var(--mainColor)');
    expect(result).toEqual({ value: 'color:var(--mainColor);', variables: [] });
  });

  it('leaves valid non-var values intact', () => {
    const result = processCssString('padding', '10px 20px');
    expect(result).toEqual({ value: 'padding:10px 20px;', variables: [] });
  });

  it('generates secondary variable for border shorthand with concatenation', () => {
    const result = processCssString('border', 'var(--borderWidth) solid black');
    expect(result).toEqual({ value: 'border:var(--borderWidth) solid black;', variables: [] });
  });

  it('generates secondary variable for background shorthand with gradient', () => {
    const result = processCssString('background', 'var(--bgColor) linear-gradient(to right, red, blue)');
    expect(result).toEqual({ value: 'background:var(--bgColor) linear-gradient(to right, red, blue);', variables: [] });
  });

  it('leaves valid box-shadow values intact', () => {
    const result = processCssString('box-shadow', '0 2px 4px var(--shadowColor)');
    expect(result).toEqual({ value: 'box-shadow:0 2px 4px var(--shadowColor);', variables: [] });
  });

  it('handles margin with var concatenated', () => {
    const result = processCssString('margin', 'var(--spacing)10px');
    expect(result).toEqual({ value: 'margin:var(--spacing) 10px;', variables: [] });
  });

  it('handles padding with simple var', () => {
    const result = processCssString('padding', 'var(--paddingValue)');
    expect(result).toEqual({ value: 'padding:var(--paddingValue);', variables: [] });
  });

  it('handles border-radius with var concatenated', () => {
    let result = processCssString('border-radius', 'var(--radius)5px');
    expect(result).toEqual({ value: 'border-radius:var(--radius) 5px;', variables: [] });

    result = processCssString('border-radius', 'var(--radius) 5px');
    expect(result).toEqual({ value: 'border-radius:var(--radius) 5px;', variables: [] });
  });

  it('handles font-family with var concatenated', () => {
    const result = processCssString('font-family', 'var(--font) "Arial", sans-serif');
    expect(result).toEqual({ value: 'font-family:var(--font) "Arial",sans-serif;', variables: [] });
  });

  it('handles text-shadow with var concatenated', () => {
    const result = processCssString('text-shadow', '0 1px 2px var(--shadowColor)');
    expect(result).toEqual({ value: 'text-shadow:0 1px 2px var(--shadowColor);', variables: [] });
  });

  it('handles background with multiple concatenations', () => {
    const result = processCssString('background', 'url(var(--bgUrl)/img1.png) var(--bgColor) repeat');
    expect(result).toEqual({
      value: 'background:url(var(--bgUrl-parsed)) var(--bgColor) repeat;',
      variables: ['--bgUrl-parsed:var(--bgUrl)+"/img1.png";']
    });
  });

  it('handles empty value', () => {
    const result = processCssString('color', '');
    expect(result).toEqual({ value: '', variables: [] });
  });

  it('handles simple numeric value', () => {
    const result = processCssString('width', '100%');
    expect(result).toEqual({ value: 'width:100%;', variables: [] });
  });

  it('handles calc function with var', () => {
    const result = processCssString('width', 'calc(var(--w) * 2)');
    expect(result).toEqual({ value: 'width:calc(var(--w) * 2);', variables: [] });
  });

  it('handles url without var', () => {
    const result = processCssString('background-image', 'url(/img/logo.png)');
    expect(result).toEqual({ value: 'background-image:url(/img/logo.png);', variables: [] });
  });

  it('handles multiple spaces normalization', () => {
    const result = processCssString('margin', '10px   20px   30px');
    expect(result).toEqual({ value: 'margin:10px 20px 30px;', variables: [] });
  });

  it('handles multiple vars separated by comma', () => {
    const result = processCssString('padding', 'var(--spacing), var(--spacing2)');
    expect(result).toEqual({ value: 'padding:var(--spacing),var(--spacing2);', variables: [] });
  });

  it('handles content with text including var', () => {
    const result = processCssString('content', '"var(--icon)"');
    expect(result).toEqual({ value: 'content:"var(--icon)";', variables: [] });
  });

  it('handles nested functions with var', () => {
    const result = processCssString('background', 'linear-gradient(to right, rgba(var(--rgb),0.5), #000)');
    expect(result).toEqual({
      value: 'background:linear-gradient(to right,rgba(var(--rgb),0.5) , #000);',
      variables: []
    });
  });

  it('handles multiple different vars in shorthand', () => {
    const result = processCssString('margin', 'var(--x) var(--y) var(--z) var(--w)');
    expect(result).toEqual({ value: 'margin:var(--x) var(--y) var(--z) var(--w);', variables: [] });
  });

  it('reuses parsed variable if same url is repeated', () => {
    const result = processCssString('background', 'url("var(--img)/a.png"), url("var(--img)/a.png")');
    expect(result).toEqual({
      value: 'background:url(var(--img-parsed)),url(var(--img-parsed));',
      variables: ['--img-parsed:var(--img)+"/a.png";']
    });
  });
});

describe('processSelectorAttributes', () => {
  it('functionality', () => {
    const result = processSelectorAttributes({
      name: 'page-1',
      type: 'class',
      attributes: {
        'align-items': 'center',
        'justify-content': 'space-around',
        'row-gap': '32px',
        'column-gap': '32px',
        'flex-wrap': 'nowrap',
        'flex-direction': 'column',
        'padding-right': '10px'
      },
      variables: {
        color: {
          fancyVariable: {
            light: '#111',
            dark: '#000',
            default: '#111'
          }
        }
      }
    });
    expect(result).toEqual([
      'align-items:center;',
      'justify-content:space-around;',
      'row-gap:32px;',
      'column-gap:32px;',
      'flex-wrap:nowrap;',
      'flex-direction:column;',
      'padding-right:10px;'
    ]);
  });
});
