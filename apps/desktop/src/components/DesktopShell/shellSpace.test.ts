import { describe, expect, it } from 'vitest';

import { authorSpace, validateSpace } from '@plitzi/sdk-authoring';

import { desktopShell } from './shellSpace';

/**
 * The window's chrome is a document now, and a document fails quietly: a step naming a callback nobody registers,
 * a binding onto a source that is not in scope, a class referred to but never declared — all of them render, and
 * all of them do nothing. This is where that is caught, because the alternative is catching it in the packaged app.
 */
describe('the desktop shell space', () => {
  const authored = authorSpace(desktopShell);

  it('authors with nothing to warn about', () => {
    expect(authored.warnings).toEqual([]);
  });

  it('passes the document validator', () => {
    const { valid, errors } = validateSpace({ schema: authored.schema, style: authored.style });

    expect(errors).toEqual([]);
    expect(valid).toBe(true);
  });

  it('asks the host for every action the host registers, and no others', () => {
    const asked = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);

        return;
      }

      if (node === null || typeof node !== 'object') {
        return;
      }

      const step = node as { action?: unknown; params?: { action?: unknown } };
      if (step.action === 'hostAction' && typeof step.params?.action === 'string') {
        asked.add(step.params.action);
      }

      Object.values(node).forEach(walk);
    };

    walk(authored.schema);

    // `DesktopShell` registers exactly these. An action it does not register is a control that does nothing at all
    // when pressed — there is no error anywhere, which is why the list is asserted rather than eyeballed.
    expect(asked).toEqual(new Set(['home', 'refresh', 'toggleSidebar', 'openSpace', 'signOut']));
  });

  /**
   * The regression this exists for: the icon controls were sized `font-size: 0`, to collapse the word that gives a
   * button its accessible name — and the icons disappeared with it. A Font Awesome glyph is sized in `em` (`fa-1x`
   * is `1em`, its width `var(--fa-width, 1.25em)`), so an em of nothing is nothing, and winning the size back meant
   * beating Font Awesome's own stylesheet, which is unlayered in the application's bundle. The label is clipped
   * instead; this keeps the size from being zeroed again.
   */
  it('leaves every icon control a font size the glyph inside it can be measured against', () => {
    const { desktop } = authored.style.platform as Record<
      string,
      Record<string, { attributes?: { base?: { default?: Record<string, string> } } } | undefined>
    >;

    ['sh-refresh', 'sh-collapse', 'sh-signout'].forEach(name => {
      const size = desktop[name]?.attributes?.base?.default?.['font-size'];

      expect(size).toBeDefined();
      expect(Number.parseFloat(size ?? '0')).toBeGreaterThan(0);
    });
  });

  it('reads the host and nothing else, so it renders with no network at all', () => {
    const sources = [...JSON.stringify(authored.schema).matchAll(/"source":"([a-z_]+)\./g)].map(match => match[1]);

    expect(new Set(sources)).toEqual(new Set(['host', 'list_owned', 'list_shared']));
  });
});
