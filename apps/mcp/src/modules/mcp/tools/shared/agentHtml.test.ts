import { describe, expect, it } from 'vitest';

import { AGENT_HTML_CHARS, agentHtml } from './agentHtml';
import { buildSpace } from '../../tests/helpers';
import { lookTool } from '../look';

/** A page as large as Plitzi's pricing page: its hydration payload, a script, a stylesheet and a lot of markup. */
const PAYLOAD = JSON.stringify({ offlineData: { schema: { flat: 'x'.repeat(2_300_000) } } });
const MARKUP = '<section class="plan"><h2>Site</h2><p>Every word of a plan.</p></section>'.repeat(9_000);
const PAGE = `<!doctype html><html><head><style>${'.a{color:red}'.repeat(500)}</style></head><body>${MARKUP}<script type="application/json" id="plitzi-ssr-data">${PAYLOAD}</script><script type="module">import('/sdk.js')</script></body></html>`;

describe('a page’s HTML, as an agent reads it', () => {
  it('leaves out the hydration payload, the scripts and the stylesheets, saying how much', () => {
    const read = agentHtml(
      '<head><style>.a{color:red}</style></head><body><h1>Hi</h1><script id="d">{"a":1}</script></body>'
    );

    expect(read).toContain('<h1>Hi</h1>');
    expect(read).toContain('<script id="d"><!-- 0 KB left out --></script>');
    expect(read).not.toContain('{"a":1}');
  });

  it('is cut at what an answer may hold, and says where and what to ask instead', () => {
    const read = agentHtml(PAGE);

    expect(read.length).toBeLessThan(AGENT_HTML_CHARS + 300);
    expect(read).not.toContain('xxxx');
    expect(read).toMatch(/<!-- cut at 100 KB of \d+ KB: view "accessibility" reads the whole page/);
  });

  // The answer of a look at a page this size was 3 MB: 923,000 tokens.
  it('keeps a look at a large page within an answer', async () => {
    const preview = {
      render: () => Promise.resolve({ ok: true as const, pagePath: '/pricing', html: PAGE, stateVersion: 'v1' })
    };
    const answer = await lookTool.execute(
      { pageRef: 'home', view: 'html' },
      { space: buildSpace(), env: 'main', persisters: {}, spaceId: 1, preview }
    );

    expect(Math.ceil(JSON.stringify(answer).length / 4)).toBeLessThan(30_000);
  });
});
