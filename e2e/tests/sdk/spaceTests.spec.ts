import { authorSpace, button, e2e, e2eResultText, runE2eTest, text, unit } from '@plitzi/sdk-authoring';

import { describeTarget, expect, test } from '../../fixtures';
import { HARNESS_ORIGIN, openHarness, renderSpace } from '../../helpers/harness';
import { KEPT_IDS, keptStateSpace } from '../../spaces';

/**
 * A space's e2e tests run by sdk-authoring's runner in a real browser: its steps pressed on the space the
 * SDK draws, its expectations held — and a failed one said with what it read, the steps after it not run.
 */

const open = async (page: Parameters<typeof openHarness>[0]): Promise<void> => {
  await openHarness(page);
  await renderSpace(page, keptStateSpace());
};

describeTarget('harness', () => {
  test('plays a visitor’s steps and holds what must be true after them', async ({ page }) => {
    const result = await runE2eTest(
      page,
      e2e.test({
        id: 'saves-favourite',
        title: 'Saving a favourite shows it',
        page: '/',
        steps: [
          e2e.expectText(KEPT_IDS.keptText, 'none', { exact: true }),
          e2e.click(KEPT_IDS.keep),
          e2e.expectText(KEPT_IDS.keptText, 'saved', { exact: true }),
          e2e.expectShown(KEPT_IDS.draftText)
        ]
      }),
      { origin: HARNESS_ORIGIN, open: () => open(page) }
    );

    expect(e2eResultText(result).slice(1)).toEqual([
      '  ✓ kept-text reads "none"',
      '  ✓ click kept-keep',
      '  ✓ kept-text reads "saved"',
      '  ✓ kept-draft-text shown'
    ]);
    expect(result.ok).toBe(true);
  });

  test('stops at the first expectation that does not hold, saying what it read', async ({ page }) => {
    const result = await runE2eTest(
      page,
      e2e.test({
        id: 'wrong-word',
        title: 'Expects a word the page never shows',
        page: '/',
        steps: [
          e2e.click(KEPT_IDS.draft),
          e2e.expectText(KEPT_IDS.draftText, 'drafted', { exact: true }),
          e2e.click(KEPT_IDS.keep)
        ]
      }),
      { origin: HARNESS_ORIGIN, open: () => open(page), expectMs: 1000 }
    );

    expect(result.ok).toBe(false);
    expect(e2eResultText(result).slice(1)).toEqual([
      '  ✓ click kept-draft',
      '  ✗ kept-draft-text reads "drafted" — it reads "typed"',
      '  · click kept-keep — not run'
    ]);
  });

  test('shows each step before it is played, and stops where whoever plays it says', async ({ page }) => {
    const before: number[] = [];
    const stop = new AbortController();
    const result = await runE2eTest(
      page,
      e2e.test({
        id: 'stopped',
        title: 'Stopped after its first step',
        page: '/',
        steps: [e2e.click(KEPT_IDS.keep), e2e.expectText(KEPT_IDS.keptText, 'saved'), e2e.click(KEPT_IDS.draft)]
      }),
      {
        origin: HARNESS_ORIGIN,
        open: () => open(page),
        signal: stop.signal,
        beforeStep: (_step, index) => {
          before.push(index);
          if (index === 1) {
            stop.abort();
          }

          return Promise.resolve();
        }
      }
    );

    expect(before).toEqual([0, 1]);
    expect(result).toMatchObject({ ok: false, stopped: true });
    expect(e2eResultText(result).slice(1)).toEqual([
      '  stopped before its last step',
      '  ✓ click kept-keep',
      '  · kept-text shows "saved" — not run',
      '  · click kept-draft — not run'
    ]);
  });

  // What `page play` learnt, played by a journey too: the copy a visitor sees, a select chosen, one hidden here said so.
  test('presses the copy shown at this width, chooses a select’s option, and says one hidden here as hidden', async ({
    page
  }) => {
    const html = [
      '<main data-hydrated>',
      '<button data-plitzi-el="go" style="display:none">Go (phone)</button>',
      '<button data-plitzi-el="go" onclick="document.querySelector(\'[data-plitzi-el=said]\').textContent=\'went\'">Go</button>',
      '<div data-plitzi-el="size"><label>Size</label>',
      '<select onchange="document.querySelector(\'[data-plitzi-el=said]\').textContent=this.value">',
      '<option value="s">Small</option><option value="l">Large</option></select></div>',
      '<button data-plitzi-el="burger" style="display:none">Menu</button>',
      '<p data-plitzi-el="said">nothing</p>',
      '</main>'
    ].join('');
    const played = await runE2eTest(
      page,
      e2e.test({
        id: 'shown-copy',
        title: 'Presses what a visitor sees',
        page: '/',
        steps: [
          e2e.click('go'),
          e2e.expectText('said', 'went', { exact: true }),
          e2e.type('size', 'Large'),
          e2e.expectText('said', 'l', { exact: true }),
          e2e.click('burger')
        ]
      }),
      { origin: HARNESS_ORIGIN, open: () => page.setContent(html), expectMs: 1000 }
    );

    expect(e2eResultText(played).slice(1, 5)).toEqual([
      '  ✓ click go',
      '  ✓ said reads "went"',
      '  ✓ type "Large" in size',
      '  ✓ said reads "l"'
    ]);
    expect(played.steps.at(-1)?.read).toContain('burger is on the page but hidden at this width');
  });

  // The hybrid: the journey drives the page, the space's own element checks hold its logic where the page got to.
  test('starts with a state, and holds the space’s element checks for the state the journey reached', async ({
    page
  }) => {
    const { schema } = authorSpace({
      name: 'greeting',
      permanentUrl: 'greeting',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            button({ id: 'go', content: 'Say hello' }),
            text({ id: 'thanks', content: 'Thanks', visible: 'state.greeted' })
          ]
        }
      ]
    });
    const space = {
      ...schema,
      tests: {
        unit: [
          unit.test({ id: 'thanks-waits', title: 'Thanks waits', element: 'thanks', expect: [unit.visible(false)] }),
          unit.test({ id: 'thanks-shows', title: 'Thanks shows', element: 'thanks', expect: [unit.visible()] })
        ]
      }
    };
    // The page's state bridge, as the SDK's dev tools put it on a page in debug mode: a press writes the state.
    const html = [
      '<main data-hydrated><button data-plitzi-el="go"',
      ' onclick="window.__plitzi.setState(\'greeted\', true)">Say hello</button></main>',
      '<script>const kept = {}; window.__plitzi = { state: key => (key ? kept[key] : kept),',
      ' sources: () => ({ state: kept }), setState: (key, value) => { kept[key] = value; return true; } };</script>'
    ].join('');
    const played = await runE2eTest(
      page,
      e2e.test({
        id: 'greets',
        title: 'A named visitor is thanked',
        page: '/',
        given: { state: { name: 'Ana' } },
        steps: [
          e2e.expectState('name', 'Ana'),
          e2e.expectCheck('thanks-waits'),
          e2e.click('go'),
          e2e.expectCheck('thanks-shows'),
          e2e.expectCheck('thanks-waits')
        ]
      }),
      { origin: HARNESS_ORIGIN, open: () => page.setContent(html), expectMs: 1000, space }
    );

    expect(e2eResultText(played).slice(1)).toEqual([
      '  ✓ state name is "Ana"',
      '  ✓ element check thanks-waits holds',
      '  ✓ click go',
      '  ✓ element check thanks-shows holds',
      '  ✗ element check thanks-waits holds — hidden expected, it is shown'
    ]);
  });
});
