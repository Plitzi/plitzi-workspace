import { describe, expect, it } from 'vitest';

import { buildSpace, capturing } from './helpers';
import { applyTool } from '../tools/apply';
import { lookTool } from '../tools/look';

import type { Operation } from '../tools';
import type { ToolContext } from '../tools/shared/tool';
import type { PreviewRequestBody, ScreenshotInput } from '../types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const ops: Operation[] = [
  {
    type: 'upsertElement',
    pageRef: 'home',
    element: { ref: 'hero-cta', type: 'button', props: { content: 'Go' } }
  }
];

/** A renderer and a browser that write down what they were asked for. */
const looking = () => {
  const rendered: PreviewRequestBody[] = [];
  const captured: ScreenshotInput[] = [];
  const space = buildSpace();
  const cap = capturing(space);
  const ctx: ToolContext = {
    space,
    env: 'main',
    persisters: cap.persisters,
    spaceId: 1,
    preview: {
      render: body => {
        rendered.push(body);

        return Promise.resolve({ ok: true, token: 't', pagePath: '/', html: '<main>page</main>', stateVersion: 'v1' });
      }
    },
    screenshot: {
      capture: input => {
        captured.push(input);

        return Promise.resolve({ ok: true, images: [{ label: 'desktop', mimeType: 'image/png', data: 'png' }] });
      }
    }
  };

  return { ctx, rendered, captured, before: space.schema, saved: cap.saved };
};

describe('plitzi_apply with look', () => {
  // The batch is written once: checked, applied in memory and rendered in one call, so nothing has to be sent again
  // to look at it before it is saved.
  it('renders the page as a dry run leaves it, from the same operations, and saves nothing', async () => {
    const { ctx, rendered, before, saved } = looking();
    const result = (await applyTool.execute({ operations: ops, dryRun: true, look: 'html' }, ctx)) as {
      dryRun?: boolean;
      look?: { html?: string };
    };

    expect(result.dryRun).toBe(true);
    expect(result.look?.html).toBe('<main>page</main>');
    expect(rendered).toEqual([expect.objectContaining({ operations: ops, includeHtml: true })]);
    expect(saved().schema).toBe(before);
  });

  it('renders what was saved when it is not a dry run', async () => {
    const { ctx, rendered } = looking();
    await applyTool.execute({ operations: ops, look: 'html' }, ctx);

    expect(rendered).toEqual([expect.objectContaining({ operations: undefined })]);
  });

  it('answers a picture as an image beside the outcome', async () => {
    const { ctx, captured } = looking();
    const result = (await applyTool.execute(
      { operations: ops, dryRun: true, look: 'image', viewport: 'mobile' },
      ctx
    )) as CallToolResult;

    expect(captured[0]?.viewports.map(viewport => viewport.label)).toEqual(['mobile']);
    expect(result.content.map(block => block.type)).toEqual(['text', 'image']);
  });

  it('does not look at a batch it refused', async () => {
    const { ctx, rendered } = looking();
    const result = (await applyTool.execute(
      { operations: [{ type: 'deleteElement', pageRef: 'home', ref: 'nowhere' }], dryRun: true, look: 'html' },
      ctx
    )) as { errors?: unknown[]; look?: unknown };

    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.look).toBeUndefined();
    expect(rendered).toEqual([]);
  });
});

describe('plitzi_look at a page a look cannot see as its visitors do', () => {
  const seeing = (rendered: { signedInOnly?: true }, shot: { ok: true } | { ok: false; error: string }) => {
    const sent: PreviewRequestBody[] = [];
    const ctx: ToolContext = {
      space: buildSpace(),
      env: 'main',
      persisters: {},
      spaceId: 1,
      preview: {
        render: body => {
          sent.push(body);

          return Promise.resolve({
            ok: true,
            pagePath: '/spaces/42',
            html: '<main/>',
            stateVersion: 'v1',
            ...rendered
          });
        }
      },
      screenshot: {
        capture: () =>
          Promise.resolve(
            shot.ok
              ? { ok: true, images: [], accessibility: [{ label: 'desktop', outline: '- main' }] }
              : { ok: false, error: shot.error, message: 'The page answered 404.' }
          )
      }
    };

    return { ctx, sent };
  };

  // A signed-in page looked at signed out showed the page beside it at that address, answered as the page asked for.
  it('says it is seen signed out, and hands the renderer the route parameters', async () => {
    const { ctx, sent } = seeing({ signedInOnly: true }, { ok: true });
    const answer = await lookTool.execute({ pageRef: 'record', routeParams: { spaceId: '42' } }, ctx);

    expect(sent[0]).toMatchObject({ pageRef: 'record', routeParams: { spaceId: '42' } });
    expect(answer).toMatchObject({
      note:
        '"record" is for signed-in visitors, and a look is signed out: what it shows is where a signed-out visitor is ' +
        'sent — the page beside it at that address, or the sign-in'
    });
  });

  // The page's own 404 was said as the browser service being down.
  it('says a page that answered an error is the page, not the browser', async () => {
    const { ctx } = seeing({}, { ok: false, error: 'RENDER_FAILED' });
    const answer = await lookTool.execute({ pageRef: 'record', routeParams: { spaceId: '42' } }, ctx);

    expect(answer).toMatchObject({
      warning: 'SCREENSHOT_UNAVAILABLE',
      hint: 'The page itself answered an error, not the browser: read the HTML below for what it says'
    });
  });
});
