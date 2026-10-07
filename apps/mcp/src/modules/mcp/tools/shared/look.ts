import { z } from 'zod';

import { unnamedControls } from '../../accessibilityOutline';

import type { AccessibilityOutline, CaptureView, ScreenshotImage, Viewport } from '../../types';
import type { Operation } from '../operations';
import type { ToolContext } from './tool';

/**
 * How a page looks — as HTML, as a picture, or as a screen reader and a browser agent read it — rendered from the saved
 * space or from a batch that was never saved.
 *
 * One path for every tool that shows a page: `plitzi_apply`'s `dryRun` (the batch it just checked, so the agent writes
 * its operations once instead of once to check, once to look and once to save), `plitzi_preview` and
 * `plitzi_screenshot` (what is saved).
 */

const VIEWPORTS: Record<'desktop' | 'mobile', Viewport> = {
  desktop: { label: 'desktop', width: 1440, height: 900 },
  mobile: { label: 'mobile', width: 390, height: 844 }
};

type LookViewport = 'desktop' | 'mobile' | 'both';

type LookView = 'html' | 'image' | 'accessibility' | 'both';

const resolveViewports = (choice: LookViewport | undefined): Viewport[] => {
  if (choice === 'both') {
    return [VIEWPORTS.desktop, VIEWPORTS.mobile];
  }

  if (choice === 'mobile') {
    return [VIEWPORTS.mobile];
  }

  return [VIEWPORTS.desktop];
};

const CAPTURES: Record<Exclude<LookView, 'html'>, CaptureView[]> = {
  image: ['image'],
  accessibility: ['accessibility'],
  both: ['image', 'accessibility']
};

export const pageRef = z.string().optional().describe('The page, by name; defaults to the space default page');

export const viewport = z
  .enum(['desktop', 'mobile', 'both'])
  .optional()
  .describe(
    'Which viewport(s) to capture. "both" catches responsive issues (e.g. overflow at one width). Default desktop.'
  );

export const fullPage = z
  .boolean()
  .optional()
  .describe('Capture the full scrollable page instead of only the visible viewport. Default false.');

/** Each viewport's outline, with what in it has no name — the part an agent acts on. */
const readingOf = (outlines: AccessibilityOutline[]) =>
  outlines.map(({ label, outline }) => ({ viewport: label, outline, unnamed: unnamedControls(outline) }));

const ACCESSIBILITY_HINT =
  'Every entry in `unnamed` is a control or picture announced by its role alone ("button") — nobody using a screen ' +
  'reader, and no browser agent, can tell what it does. Name it — a button: `title` or words inside; a link: ' +
  '`label`; a field: `label` (with `hideLabel` to keep it out of sight); an image: `alt`, or `decorative: true`; an ' +
  'icon that means something alone: `label`. `line` is where it sits in the outline.';

type LookRequest = {
  pageRef?: string;
  /** A batch to render without saving it; left out, what is saved. */
  operations?: Operation[];
  view: LookView;
  viewport?: LookViewport;
  fullPage?: boolean;
};

/** What a look found: the facts about the page, and the pictures when one was asked for and could be taken. */
type Look = { meta: Record<string, unknown>; images: ScreenshotImage[] };

/** A look that could not happen at all — no renderer, or a batch the renderer refused — said as the tools say it. */
type LookRefusal = { refused: Record<string, unknown> };

export const lookAt = async (ctx: ToolContext, request: LookRequest): Promise<Look | LookRefusal> => {
  if (!ctx.preview || ctx.spaceId === undefined) {
    return {
      refused: {
        error: 'PREVIEW_UNAVAILABLE',
        message: 'Visual preview is not enabled on this server.',
        hint: 'Preview needs the SSR render service; it is unavailable in MCP-only mode.'
      }
    };
  }

  const draft = { spaceId: ctx.spaceId, env: ctx.env, pageRef: request.pageRef, operations: request.operations };
  const page = request.pageRef ?? 'default';

  // On the way to an image the HTML is dead weight: the browser renders the same draft again from the token, so
  // asking for it would have the server render the page twice. It is only rendered on the paths that read it.
  const wantsHtml = request.view === 'html' || !ctx.screenshot;
  const rendered = await ctx.preview.render({ ...draft, includeHtml: wantsHtml });
  if (!rendered.ok) {
    return { refused: rendered };
  }

  const facts = { pageRef: page, pagePath: rendered.pagePath, stateVersion: rendered.stateVersion };
  if (request.view === 'html') {
    return { meta: { ...facts, html: rendered.html }, images: [] };
  }

  // Degrade rather than fail: with no browser wired the HTML still says what the page holds.
  if (!ctx.screenshot) {
    return {
      meta: {
        ...facts,
        warning: 'SCREENSHOT_DISABLED',
        message:
          request.view === 'image'
            ? 'The screenshot service is not configured; returning the HTML preview instead.'
            : 'No browser is configured, so the accessibility tree cannot be read; returning the HTML preview instead. Its roles and names are in the markup: every button, link and field needs words, every image an `alt`.',
        html: rendered.html
      },
      images: []
    };
  }

  const viewports = resolveViewports(request.viewport);
  const shot = await ctx.screenshot.capture({
    pagePath: rendered.pagePath,
    token: rendered.token,
    viewports,
    fullPage: request.fullPage,
    views: CAPTURES[request.view]
  });
  if (!shot.ok) {
    // The HTML was skipped above, so the fallback renders it now — the cost lands on the failing call rather than on
    // every successful one. Same draft, same operations, so it is the same page.
    const fallback = await ctx.preview.render(draft);

    return {
      meta: {
        ...facts,
        warning: 'SCREENSHOT_UNAVAILABLE',
        message: `The screenshot service failed (${shot.message}); returning the HTML preview instead.`,
        hint: 'The dedicated browser service is down or unreachable. Inspect the HTML, or retry later.',
        html: fallback.ok ? fallback.html : ''
      },
      images: []
    };
  }

  const meta = { ...facts, viewports: viewports.map(v => v.label) };
  const accessibility =
    request.view === 'image'
      ? {}
      : shot.accessibility
        ? { accessibility: readingOf(shot.accessibility), hint: ACCESSIBILITY_HINT }
        : {
            warning: 'ACCESSIBILITY_UNSUPPORTED',
            message:
              'The browser service answered without the accessibility tree — it predates the accessibility view. The image, if asked for, is still here.'
          };

  return { meta: { ...meta, ...accessibility }, images: request.view === 'accessibility' ? [] : shot.images };
};
