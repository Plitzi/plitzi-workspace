import { describe, expect, it } from 'vitest';

import { classHtmlParts } from './classHtmlParts';

describe('classHtmlParts', () => {
  it('puts each part under the class given for it', () => {
    const html =
      '<h2>Title</h2><p>A <a href="/x">link</a>, <strong>strong</strong>, <em>em</em> and <code>code</code>.</p>' +
      '<ul><li>one</li></ul><blockquote>said</blockquote><hr><img src="/a.png">' +
      '<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>';

    expect(
      classHtmlParts(html, {
        heading: 'h',
        heading2: 'h2',
        paragraph: 'p',
        link: 'a',
        strong: 's',
        emphasis: 'e',
        code: 'c',
        list: 'l',
        listItem: 'li',
        quote: 'q',
        divider: 'd',
        image: 'i',
        table: 't',
        tableHead: 'th',
        tableRow: 'tr',
        tableHeaderCell: 'thc',
        tableCell: 'tc'
      })
    ).toBe(
      '<h2 class="h h2">Title</h2><p class="p">A <a href="/x" class="a">link</a>, <strong class="s">strong</strong>, ' +
        '<em class="e">em</em> and <code class="c">code</code>.</p><ul class="l"><li class="li">one</li></ul>' +
        '<blockquote class="q">said</blockquote><hr class="d"><img src="/a.png" class="i"><table class="t">' +
        '<thead class="th"><tr class="tr"><th class="thc">a</th></tr></thead><tbody><tr class="tr">' +
        '<td class="tc">b</td></tr></tbody></table>'
    );
  });

  it('keeps the class a tag already has beside its own, however it is quoted', () => {
    const classNames = { paragraph: 'body' };

    expect(classHtmlParts('<p class="lead">a</p>', classNames)).toBe('<p class="lead body">a</p>');
    expect(classHtmlParts('<p class=\'lead\' title="a">a</p>', classNames)).toBe(
      '<p class="lead body" title="a">a</p>'
    );
    expect(classHtmlParts('<p class=lead>a</p>', classNames)).toBe('<p class="lead body">a</p>');
  });

  it('dresses the older editors’ b and i as strong and emphasis', () => {
    expect(classHtmlParts('<b>a</b><i>b</i>', { strong: 's', emphasis: 'e' })).toBe(
      '<b class="s">a</b><i class="e">b</i>'
    );
  });

  it('gives a block its codeBlock, and leaves the code inside it to the block', () => {
    expect(classHtmlParts('<pre><code>x</code></pre><code>y</code>', { code: 'c', codeBlock: 'b' })).toBe(
      '<pre class="b"><code>x</code></pre><code class="c">y</code>'
    );
  });

  it('writes the class before a self-closing slash, and reads past a > inside a quoted value', () => {
    expect(classHtmlParts('<img src="/a.png" alt="a > b" />', { image: 'i' })).toBe(
      '<img src="/a.png" alt="a > b" class="i" />'
    );
  });

  it('leaves the markup as it is with no class to give', () => {
    const html = '<h2 id="x">Title</h2><p>Body</p>';

    expect(classHtmlParts(html, {})).toBe(html);
    expect(classHtmlParts(html, { image: 'i' })).toBe(html);
  });
});
