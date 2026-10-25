import { describe, expect, it } from 'vitest';

import {
  authorSpace,
  button,
  container,
  dropdown,
  dropdownPopup,
  fontAwesome,
  form,
  formControl,
  lintSpace,
  markdown,
  text
} from '../../index';
import { addElement, errorsOf, homeId, setFlow, step, warningsOf, withChange } from './tests/lintFixture';

import type { Schema } from '@plitzi/sdk-shared';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

describe('lintSpace', () => {
  describe('style', () => {
    it('colour-without-dark', () => {
      const documents = withChange(({ style }) => {
        style.variables.color = { ...style.variables.color, ink: { light: '#111111', default: '#111111' } };
      });

      expect(warningsOf(documents)).toContain('colour-without-dark');
    });

    it('unknown-variable', () => {
      const documents = withChange(({ style }) => {
        style.platform.desktop.card = {
          name: 'card',
          type: 'class',
          cache: '',
          attributes: { base: { default: { color: 'var(--inkk)', 'background-color': 'var(--edge, #ccc)' } } }
        };
      });

      expect(warningsOf(documents)).toContain('unknown-variable');
    });

    it('animation-name-unknown', () => {
      const documents = withChange(({ schema, style }) => {
        schema.settings.customCss = '@keyframes caret-blink {\n  from {\n    opacity: 1;\n  }\n}';
        style.platform.desktop.caret = {
          name: 'caret',
          type: 'class',
          cache: '',
          attributes: {
            base: {
              default: { 'animation-name': 'caret-blnk, plitzi-motion-fade' },
              pseudos: { after: { default: { content: '""', 'animation-name': 'caret-blink' } } }
            }
          }
        };
      });
      const unknown = lintSpace(documents).warnings.filter(issue => issue.code === 'animation-name-unknown');

      expect(unknown).toHaveLength(1);
      expect(unknown[0].message).toContain('"caret-blnk"');
      expect(unknown[0].message).toContain('did you mean "caret-blink"?');
    });

    // The copy of a shop asked DM Sans for 400 where it loads 500 and 700: its pill drew at 500, and no check said so.
    it('font-weight-not-loaded', () => {
      const font = { fallback: 'sans-serif', styles: ['normal' as const], source: 'google' as const };
      const documents = withChange(({ style }) => {
        style.fonts = [
          { ...font, family: 'DM Sans', weights: [500, 700] },
          { ...font, family: 'Archivo', weights: [700] }
        ];
        style.variables.custom = { ...style.variables.custom, heading: "'Archivo', sans-serif" };
        const rules = (name: string, rule: Record<string, string>) => ({
          name,
          type: 'class' as const,
          cache: '',
          attributes: { base: { default: rule } }
        });
        style.platform.desktop.pill = rules('pill', { 'font-weight': '400' });
        style.platform.desktop.title = rules('title', { 'font-family': 'var(--heading)', 'font-weight': '500' });
        style.platform.desktop.lead = rules('lead', { 'font-family': "'DM Sans'", 'font-weight': 'bold' });
        style.platform.desktop.code = rules('code', { 'font-family': 'ui-monospace, monospace', 'font-weight': '300' });
      });
      const unloaded = lintSpace(documents).warnings.filter(issue => issue.code === 'font-weight-not-loaded');

      expect(unloaded.map(issue => issue.details)).toEqual([
        { selector: 'pill', weight: 400 },
        { selector: 'title', weight: 500, family: 'Archivo' }
      ]);
      expect(unloaded[0].message).toContain('no family the space loads has ("DM Sans" 500/700, "Archivo" 700)');
    });

    it('heading-level-overridden', () => {
      const headings = (classes: Record<string, { 'font-size': string } | { 'scroll-margin-top': string }>) =>
        lintSpace(
          authorSpace({
            name: 'Docs',
            permanentUrl: 'docs',
            classes,
            pages: [
              {
                id: 'home',
                name: 'Home',
                slug: '',
                body: [
                  markdown('## Hi', { id: 'doc', slots: { heading: 'prose-heading', heading2: 'prose-heading2' } })
                ]
              }
            ]
          })
        ).warnings.filter(issue => issue.code === 'heading-level-overridden');

      // The general class written after the level's: every <h2> shows the general size.
      const lost = headings({ 'prose-heading2': { 'font-size': '26px' }, 'prose-heading': { 'font-size': '20px' } });
      expect(lost).toHaveLength(1);
      expect(lost[0].message).toContain('every <h2> shows 20px, not 26px');
      // Written the other way round the level wins, and two classes that never share a property cannot disagree.
      expect(headings({ 'prose-heading': { 'font-size': '20px' }, 'prose-heading2': { 'font-size': '26px' } })).toEqual(
        []
      );
      expect(
        headings({ 'prose-heading2': { 'font-size': '26px' }, 'prose-heading': { 'scroll-margin-top': '80px' } })
      ).toEqual([]);
    });

    it('page-template', () => {
      // The fixture's home page has no server provider: only `navigation` is there when the head is written.
      const seo = (template: string) =>
        lintSpace(
          withChange(({ schema }) => {
            const home = schema.flat[homeId(schema)];
            home.attributes.seoEnabled = true;
            home.attributes.seoPageTitle = template;
          })
        ).errors.filter(issue => issue.code === 'page-template');

      expect(seo('{{ navigation.routeParams.slug }} — Blog')).toEqual([]);
      expect(seo('{{ state.title }} — Blog')[0].message).toContain('`seoTitle` reads `state`');

      const structured = (name: string) =>
        lintSpace(
          withChange(({ schema }) => {
            const home = schema.flat[homeId(schema)];
            home.attributes.seoEnabled = true;
            home.attributes.seoStructuredData = [{ '@context': 'https://schema.org', '@type': 'Person', name }];
          })
        ).errors.filter(issue => issue.code === 'page-template');

      expect(structured('{{ navigation.routeParams.id }}')).toEqual([]);
      expect(structured('{{ state.name }}')[0].message).toContain('`structuredData` reads `state`');
    });

    it('required-message-unused', () => {
      const unused = (required?: boolean) =>
        lintSpace(
          authorSpace({
            name: 'Form',
            permanentUrl: 'form',
            pages: [
              {
                id: 'home',
                name: 'Home',
                slug: '',
                body: [
                  form({
                    id: 'riddle',
                    children: [
                      formControl({
                        id: 'answer',
                        name: 'answer',
                        label: 'Answer',
                        requiredMessage: 'Write something',
                        ...(required === undefined ? {} : { required })
                      })
                    ]
                  })
                ]
              }
            ]
          })
        ).warnings.filter(issue => issue.code === 'required-message-unused');

      expect(unused()).toHaveLength(1);
      expect(unused()[0].message).toContain('("Write something") but nothing requires it');
      expect(unused(false)).toHaveLength(1);
      expect(unused(true)).toEqual([]);
    });

    it('focus-on-field-box', () => {
      const ring = { outline: '2px solid red' };
      const focused = (subType: 'email' | 'select' | 'textarea', state: 'focus' | 'focus-visible' | 'focus-within') =>
        lintSpace(
          authorSpace({
            name: 'Form',
            permanentUrl: 'form',
            classes: { box: { css: { padding: '8px' }, states: { [state]: ring } } },
            pages: [
              {
                id: 'home',
                name: 'Home',
                slug: '',
                body: [
                  form({
                    id: 'signup',
                    children: [
                      formControl({ id: 'email', subType, name: 'email', label: 'Email', slots: { input: 'box' } })
                    ]
                  })
                ]
              }
            ]
          })
        ).warnings.filter(issue => issue.code === 'focus-on-field-box');

      const dead = focused('email', 'focus');
      expect(dead).toHaveLength(1);
      expect(dead[0].message).toContain('"email" field whose `input` slot ("box") sets `focus`');
      expect(focused('select', 'focus-visible')).toHaveLength(1);
      // The box's own state, and a field that is its own box, are seen.
      expect(focused('email', 'focus-within')).toEqual([]);
      expect(focused('textarea', 'focus')).toEqual([]);
    });

    // A header menu's class set `position`, and its popup lay in the header's flow; a class gave an icon
    // another font, and it drew "≡" — every check passed both.
    it('popup-position-set', () => {
      const warned = (popup: Record<string, string>, icon: Record<string, string>) =>
        lintSpace(
          authorSpace({
            name: 'Menu',
            permanentUrl: 'menu',
            classes: { menu: { css: popup }, glyph: { css: icon } },
            pages: [
              {
                id: 'home',
                name: 'Home',
                slug: '',
                body: [
                  dropdown({
                    id: 'site-menu',
                    children: [
                      fontAwesome({ id: 'site-burger', icon: 'fa-solid fa-bars', class: 'glyph' }),
                      dropdownPopup({
                        id: 'site-menu-popup',
                        class: 'menu',
                        children: [text({ id: 'm', content: 'Rooms' })]
                      })
                    ]
                  })
                ]
              }
            ]
          })
        ).warnings.filter(issue => issue.code === 'popup-position-set' || issue.code === 'icon-font-replaced');

      const warnings = warned({ position: 'absolute', padding: '8px' }, { color: 'red' });
      expect(warnings.map(issue => issue.code)).toEqual(['popup-position-set']);
      expect(warnings[0].message).toContain('class "menu" sets `position`');
      expect(warned({ padding: '8px', 'min-width': '200px' }, { color: 'red' })).toEqual([]);
    });

    it('icon-font-replaced', () => {
      const warned = (popup: Record<string, string>, icon: Record<string, string>) =>
        lintSpace(
          authorSpace({
            name: 'Menu',
            permanentUrl: 'menu',
            classes: { menu: { css: popup }, glyph: { css: icon } },
            pages: [
              {
                id: 'home',
                name: 'Home',
                slug: '',
                body: [
                  dropdown({
                    id: 'site-menu',
                    children: [
                      fontAwesome({ id: 'site-burger', icon: 'fa-solid fa-bars', class: 'glyph' }),
                      dropdownPopup({
                        id: 'site-menu-popup',
                        class: 'menu',
                        children: [text({ id: 'm', content: 'Rooms' })]
                      })
                    ]
                  })
                ]
              }
            ]
          })
        ).warnings.filter(issue => issue.code === 'popup-position-set' || issue.code === 'icon-font-replaced');

      expect(warned({ padding: '8px' }, { 'font-family': 'monospace' }).map(issue => issue.code)).toEqual([
        'icon-font-replaced'
      ]);
      expect(warned({ padding: '8px' }, { color: 'red', 'font-size': '20px' })).toEqual([]);
    });

    it('element-slot-unknown', () => {
      const documents = withChange(({ schema, style }) => {
        schema.flat.go.definition.styleSelectors.icn = 'card';
        style.platform.desktop.modalContainer = {
          name: 'modalContainer',
          type: 'element',
          componentType: 'modalContainer',
          cache: '',
          attributes: { base: { default: {} }, rootContainr: { default: { color: 'red' } } }
        };
      });
      const issues = lintSpace(documents).errors.filter(issue => issue.code === 'element-slot-unknown');

      expect(issues.map(issue => issue.message)).toEqual([
        expect.stringMatching(/\(go\).* names the slot "icn", which a button does not have — did you mean "icon"\?/),
        expect.stringMatching(/`elements.modalContainer.slots` names the slot "rootContainr".*"rootContainer"/)
      ]);
    });

    it('leaves a slot nobody put a class on alone, and one of a type it does not know', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.go.definition.styleSelectors.icn = '';
        schema.flat.box.definition.type = 'pluginCard';
        schema.flat.box.definition.styleSelectors.frame = 'card';
      });

      expect(errorsOf(documents)).not.toContain('element-slot-unknown');
    });
  });
  describe('accessibility', () => {
    const iconOnly = (schema: Schema, id: string, type: 'button' | 'link', attributes: Record<string, unknown>) => {
      addElement(schema, { id, type, attributes });
      addElement(schema, { id: `${id}-icon`, type: 'fontAwesome', attributes: { icon: 'fa-solid fa-xmark' } });
      const home = homeId(schema);
      schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(
        item => item !== `${id}-icon`
      );
      schema.flat[`${id}-icon`].definition.parentId = id;
      schema.flat[id].definition.items = [`${id}-icon`];
    };

    it('control-without-name', () => {
      const documents = withChange(({ schema }) => {
        iconOnly(schema, 'close', 'button', { content: '' });
      });

      expect(warningsOf(documents)).toContain('control-without-name');
    });

    it('control-without-name still reads a link with no words, inside or of its own', () => {
      const documents = withChange(({ schema }) => {
        iconOnly(schema, 'profile', 'link', { content: '' });
      });

      expect(warningsOf(documents)).toContain('control-without-name');
    });

    it('control-without-name is quiet once a title, a label or words inside name the control', () => {
      const documents = withChange(({ schema }) => {
        iconOnly(schema, 'close', 'button', { content: '', title: 'Close' });
        iconOnly(schema, 'profile', 'link', { label: 'Your profile' });
        // Its own words, as the content-attribute suggestion writes them: a link that draws `content` is named by it.
        addElement(schema, { id: 'pricing', type: 'link', attributes: { content: 'Pricing' } });
        addElement(schema, { id: 'email', type: 'formControl', attributes: { label: '', placeholder: 'Email' } });
        addElement(schema, { id: 'plain', type: 'button', attributes: {} });
      });

      expect(warningsOf(documents)).not.toContain('control-without-name');
    });

    it('control-without-name reads a field nothing names — a placeholder names only a field typed into', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'email', type: 'formControl', attributes: { label: '', placeholder: '' } });
        addElement(schema, {
          id: 'swatch',
          type: 'formControl',
          attributes: { subType: 'color', label: '', placeholder: 'Colour' }
        });
        addElement(schema, {
          id: 'tint',
          type: 'formControl',
          attributes: { subType: 'color', label: 'Tint', hideLabel: true }
        });
      });
      const flagged = lintSpace(documents)
        .warnings.filter(issue => issue.code === 'control-without-name')
        .map(issue => issue.elementId);

      expect(flagged).toEqual(['email', 'swatch']);
    });

    it('embed-without-title', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'map', type: 'embed', attributes: { src: 'https://maps.example.com', title: '' } });
        addElement(schema, {
          id: 'video',
          type: 'embed',
          attributes: { src: 'https://v.example.com', title: 'Launch' }
        });
      });
      const flagged = lintSpace(documents)
        .warnings.filter(issue => issue.code === 'embed-without-title')
        .map(issue => issue.elementId);

      expect(flagged).toEqual(['map']);
    });

    it('image-without-alt', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'hero', type: 'image', attributes: { src: '/hero.png', alt: '' } });
        addElement(schema, { id: 'texture', type: 'image', attributes: { src: '/grain.png', decorative: true } });
        addElement(schema, { id: 'team', type: 'image', attributes: { src: '/team.png', alt: 'The team at work' } });
      });
      const flagged = lintSpace(documents)
        .warnings.filter(issue => issue.code === 'image-without-alt')
        .map(issue => issue.elementId);

      expect(flagged).toEqual(['hero']);
    });

    it('click-on-static-element', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'box', [step('click', 'trigger', 'onClick', { elementId: 'box' })]);
      });

      expect(warningsOf(documents)).toContain('click-on-static-element');
    });

    it('click-on-static-element leaves an empty backdrop alone', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'scrim', type: 'container', attributes: {} });
        setFlow(schema, 'scrim', [step('click', 'trigger', 'onClick', { elementId: 'scrim' })]);
      });

      expect(warningsOf(documents)).not.toContain('click-on-static-element');
    });

    // The carousel's dots were empty list items with a click, and neither author nor lint said a thing.
    it('click-on-static-element on an empty item of a list: a control drawn as a shape, no backdrop', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'dot', type: 'listItem', attributes: {} });
        setFlow(schema, 'dot', [step('click', 'trigger', 'onClick', { elementId: 'dot' })]);
      });

      expect(warningsOf(documents)).toContain('click-on-static-element');
    });

    it('label-ignored', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'row', type: 'container', attributes: { subType: 'li', label: 'A row' } });
        addElement(schema, { id: 'menu', type: 'container', attributes: { subType: 'nav', label: 'Main' } });
      });
      const flagged = lintSpace(documents)
        .warnings.filter(issue => issue.code === 'label-ignored')
        .map(issue => issue.elementId);

      expect(flagged).toEqual(['row']);
    });

    it('control-in-decorative, and nothing else inside an illustration', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'mock', type: 'container', attributes: { decorative: true } });
        iconOnly(schema, 'mock-cta', 'button', { content: '' });
        addElement(schema, { id: 'mock-card', type: 'container', attributes: {} });
        addElement(schema, { id: 'mock-shot', type: 'image', attributes: { src: '/shot.png' } });
        const home = homeId(schema);
        for (const id of ['mock-cta', 'mock-card', 'mock-shot']) {
          schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(item => item !== id);
          schema.flat[id].definition.parentId = 'mock';
        }
        schema.flat.mock.definition.items = ['mock-cta', 'mock-card', 'mock-shot'];
        schema.flat['mock-card'].definition.items = [];
        setFlow(schema, 'mock-card', [step('click', 'trigger', 'onClick', { elementId: 'mock-card' })]);
      });
      const accessibility = lintSpace(documents).warnings.filter(issue =>
        ['control-in-decorative', 'control-without-name', 'image-without-alt', 'click-on-static-element'].includes(
          issue.code
        )
      );

      expect(accessibility.map(issue => [issue.code, issue.elementId])).toEqual([
        ['control-in-decorative', 'mock-cta']
      ]);
    });

    it('dropdown-without-control', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'menu', type: 'dropdown', attributes: {} });
        addElement(schema, { id: 'menu-popup', type: 'dropdownPopup', attributes: {} });
        addElement(schema, { id: 'menu-avatar', type: 'container', attributes: {} });
        const home = homeId(schema);
        schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(
          item => item !== 'menu-popup' && item !== 'menu-avatar'
        );
        schema.flat['menu-popup'].definition.parentId = 'menu';
        schema.flat['menu-avatar'].definition.parentId = 'menu';
        schema.flat.menu.definition.items = ['menu-popup', 'menu-avatar'];
      });

      expect(warningsOf(documents)).toContain('dropdown-without-control');
    });

    it('heading-level-skipped', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'title', type: 'heading', attributes: { subType: 'h1', content: 'Plans' } });
        addElement(schema, { id: 'fine-print', type: 'heading', attributes: { subType: 'h3', content: 'Terms' } });
        addElement(schema, { id: 'faq', type: 'heading', attributes: { subType: 'h2', content: 'FAQ' } });
      });
      const flagged = lintSpace(documents)
        .warnings.filter(issue => issue.code === 'heading-level-skipped')
        .map(issue => issue.elementId);

      expect(flagged).toEqual(['fine-print']);
    });
  });
  describe('controls', () => {
    const faq = (controls: string) =>
      authorSpace({
        name: 'Faq',
        permanentUrl: 'faq',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              button({ id: 'faq-toggle', content: 'Shipping', ariaExpanded: false, controls }),
              container({ id: 'faq_answer', children: [text('Three days.')] })
            ]
          }
        ]
      });

    /** Named by its id, as every reference is: the element is given an anchor, and the button names the anchor. */
    it('resolves an element’s id to an anchor it gives that element', () => {
      const { schema } = faq('faq_answer');

      expect(schema.flat.faq_answer.definition.anchor).toBe('faq-answer');
      expect(schema.flat['faq-toggle'].attributes.controls).toBe('faq-answer');
    });

    it('controls-unknown', () => {
      expect(() => faq('faq-anser')).toThrow(/controls "faq-anser", which is no element of the space/);
    });

    it('controls-no-anchor', () => {
      const { schema, style } = faq('faq_answer');
      schema.flat['faq-toggle'].attributes.controls = 'nowhere';

      expect(lintSpace({ schema, style }).warnings.map(warning => warning.code)).toContain('controls-no-anchor');
    });
  });
});
