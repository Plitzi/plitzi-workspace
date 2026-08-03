import { describe, expect, it } from 'vitest';

import { rebaseHtmlMedia, sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('drops script blocks with their contents', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('drops an unterminated script tag a truncated field can produce', () => {
    expect(sanitizeHtml('<p>ok</p><script src="https://evil.example.com/x.js">')).toBe('<p>ok</p>');
  });

  it('strips inline event handlers, quoted or bare', () => {
    expect(sanitizeHtml('<img src="/a.png" onerror="steal()">')).toBe('<img src="/a.png">');
    expect(sanitizeHtml('<div onclick=go()>x</div>')).toBe('<div>x</div>');
  });

  it('strips javascript: and data: targets', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe('<a>x</a>');
  });

  it('leaves ordinary prose markup untouched', () => {
    const html = '<h2>Title</h2><p>Body with <strong>bold</strong> and <a href="/about">a link</a>.</p>';

    expect(sanitizeHtml(html)).toBe(html);
  });

  // The fields go with the form on purpose: a credential-harvesting form stripped down to orphaned inputs is still
  // a broken login box on the page, and the whole block is what does not belong in a body field.
  it('removes iframes and forms with their contents', () => {
    expect(sanitizeHtml('<p>a</p><iframe src="https://evil.example.com"></iframe>')).toBe('<p>a</p>');
    expect(sanitizeHtml('<p>a</p><form action="/steal"><input name="pw"></form>')).toBe('<p>a</p>');
  });
});

describe('rebaseHtmlMedia', () => {
  it('rebases relative sources inside the markup', () => {
    expect(rebaseHtmlMedia('<img src="/uploads/a.png">', 'https://cms.example.com/')).toBe(
      '<img src="https://cms.example.com/uploads/a.png">'
    );
  });

  it('leaves absolute and protocol-relative sources alone', () => {
    const html = '<img src="https://cdn.example.com/a.png"><img src="//cdn.example.com/b.png">';

    expect(rebaseHtmlMedia(html, 'https://cms.example.com')).toBe(html);
  });

  it('is a no-op without a base', () => {
    expect(rebaseHtmlMedia('<img src="/uploads/a.png">', '')).toBe('<img src="/uploads/a.png">');
  });
});
