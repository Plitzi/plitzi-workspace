import { describe, expect, it } from 'vitest';

import { authorSpace, validateSpace, visibleWhen } from './index';
import { container, minimal, text } from './tests/space';

import type { ElementSpec, SpaceSpec } from './index';
import type { StyleObject } from '@plitzi/sdk-shared';

describe('authorSpace / what it refuses', () => {
  it('expands the shorthands an author writes, so the style editor can read the result back', () => {
    const { schema, style } = authorSpace({
      name: 'Short',
      permanentUrl: 'short',
      pages: [{ name: 'Home', slug: '', body: [container([], { padding: '96px 24px', gap: '8px' })] }]
    });

    const boxId = schema.flat[schema.pages[0]].definition.items?.[0] as string;
    const selector = schema.flat[boxId].definition.styleSelectors.base;

    expect(style.platform.desktop[selector].attributes.base.default).toEqual({
      'padding-top': '96px',
      'padding-right': '24px',
      'padding-bottom': '96px',
      'padding-left': '24px',
      'row-gap': '8px',
      'column-gap': '8px'
    });
  });

  it('reads a bare rule set as the desktop breakpoint', () => {
    const { schema, style } = authorSpace({
      name: 'Bare',
      permanentUrl: 'bare-css',
      pages: [{ name: 'Home', slug: '', body: [text('hi', { color: 'red' })] }]
    });

    const textId = schema.flat[schema.pages[0]].definition.items?.[0] as string;
    const selector = schema.flat[textId].definition.styleSelectors.base;

    expect(style.platform.desktop[selector].attributes.base.default).toEqual({ color: 'red' });
    expect(style.platform.mobile[selector]).toBeUndefined();
  });

  it('refuses a property the style editor could not read back', () => {
    expect(() =>
      authorSpace({
        name: 'Typo',
        permanentUrl: 'typo',
        pages: [{ name: 'Home', slug: '', body: [text('hi', { fontSmoothing: 'antialiased' })] }]
      })
    ).toThrow(/"font-smoothing"/);
  });

  it('refuses an element that asks for a shared class and rules of its own at once', () => {
    // One base selector per element: keeping the class and dropping the rules is what it used to do, silently.
    expect(() =>
      authorSpace({
        name: 'Both',
        permanentUrl: 'both',
        classes: { card: { padding: '8px' } },
        pages: [{ name: 'Home', slug: '', body: [{ type: 'text', class: 'card', css: { color: 'red' } }] }]
      })
    ).toThrow(/one base selector/);
  });

  it('names the class an author probably meant when the one they wrote does not exist', () => {
    expect(() =>
      authorSpace({
        name: 'Typo',
        permanentUrl: 'class-typo',
        classes: { card: { padding: '8px' } },
        pages: [{ name: 'Home', slug: '', body: [{ type: 'text', class: 'crad' }] }]
      })
    ).toThrow(/"crad".*did you mean "card"/);
  });

  it('refuses a slot pointing at a class nothing declares', () => {
    expect(() =>
      authorSpace({
        name: 'Slot',
        permanentUrl: 'slot-typo',
        classes: { field: { width: '100%' } },
        pages: [{ name: 'Home', slug: '', body: [{ type: 'formControl', slots: { input: 'fields' } }] }]
      })
    ).toThrow(/Slot "input".*"fields"/);
  });

  describe('a slot the type does not have', () => {
    const slotNames = { formControl: ['label', 'requiredMark', 'input', 'field', 'icon', 'error'], text: [] };
    const spaceWith = (body: ElementSpec[], elements?: SpaceSpec['elements']): SpaceSpec => ({
      name: 'Slot',
      permanentUrl: 'slot-unknown',
      classes: { field: { width: '100%' } },
      ...(elements ? { elements } : {}),
      pages: [{ name: 'Home', slug: '', body }]
    });

    it('is refused with the one it meant and the ones it has', () => {
      expect(() => authorSpace(spaceWith([{ type: 'formControl', slots: { feild: 'field' } }]), { slotNames })).toThrow(
        /\[element-slot-unknown\].*"feild".*did you mean "field".*Its slots: label, requiredMark/s
      );
    });

    it('is refused on a type with no slots, which takes the class itself', () => {
      expect(() => authorSpace(spaceWith([{ type: 'text', slots: { label: 'field' } }]), { slotNames })).toThrow(
        /a text has no slots: give the element itself the class/i
      );
    });

    it('is refused in the defaults of a whole type', () => {
      expect(() =>
        authorSpace(spaceWith([], { formControl: { slots: { inptu: { width: '100%' } } } }), { slotNames })
      ).toThrow(/`elements.formControl.slots` names the slot "inptu".*did you mean "input"/);
    });

    it('is left alone for a type nobody said the slots of', () => {
      expect(() =>
        authorSpace(spaceWith([{ type: 'formControl', slots: { feild: 'field' } }]), { slotNames: {} })
      ).not.toThrow();
    });
  });

  /**
   * The resolution only happens when the caller supplied the catalog, which is what the composed entry does. A
   * space authored straight from this package writes its sources as declared — the fragment has to stay usable on
   * documents whose element library nobody here knows.
   */
  it('resolves a source that named the name alone, when it was told what publishes one', () => {
    const { schema } = authorSpace(
      {
        name: 'Bound',
        permanentUrl: 'relative-source',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              {
                type: 'apiContainer',
                id: 'posts',
                runtime: 'server',
                attributes: { action: 'list' },
                children: [{ type: 'text', bind: { content: 'posts.title' } }]
              }
            ]
          }
        ]
      },
      { sourceTypes: { apiContainer: 'apiContainer' } }
    );

    const bound = Object.values(schema.flat).find(element => element.definition.bindings?.attributes);

    expect(bound?.definition.bindings?.attributes?.[0].source).toBe('apiContainer_posts.title');
  });

  it('refuses a name that shadows a global data source', () => {
    expect(() =>
      authorSpace(
        {
          name: 'Shadow',
          permanentUrl: 'shadow',
          pages: [{ name: 'Home', slug: '', body: [{ type: 'apiContainer', id: 'state' }] }]
        },
        { sourceTypes: { apiContainer: 'apiContainer' } }
      )
    ).toThrow(/one of the global data sources/);
  });

  it('refuses a binding whose source names an element that is not there', () => {
    // The quietest failure a space can carry: the binding resolves to nothing, the element renders its
    // placeholder, and every layer below considers the document perfectly valid.
    expect(() =>
      authorSpace({
        name: 'Bound',
        permanentUrl: 'bad-source',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              { type: 'apiContainer', id: 'posts', runtime: 'server', attributes: { action: 'list' } },
              { type: 'text', bind: { content: 'apiContainer_post.title' } }
            ]
          }
        ]
      })
    ).toThrow(/no element answers to the name/);
  });

  it('takes the short binding form, and lets a full one target element state', () => {
    const { schema } = authorSpace({
      name: 'Bound',
      permanentUrl: 'bound-ok',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            { type: 'apiContainer', id: 'posts', runtime: 'server', attributes: { action: 'list' } },
            { type: 'text', bind: { content: 'apiContainer_posts.title' } },
            { type: 'text', bind: [visibleWhen('apiContainer_posts.hasPosts')] }
          ]
        }
      ]
    });

    const [, short, state] = (schema.flat[schema.pages[0]].definition.items ?? []).map(id => schema.flat[id]);

    expect(short.definition.bindings?.attributes?.[0]).toMatchObject({
      to: 'content',
      source: 'apiContainer_posts.title'
    });
    expect(state.definition.bindings?.initialState?.[0]).toMatchObject({ to: 'visibility' });
  });

  it('names the element in the builder tree, without shadowing an attribute called label', () => {
    const { schema } = authorSpace({
      name: 'Labelled',
      permanentUrl: 'labelled',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [{ type: 'link', attributes: { href: '/', label: 'Home' }, meta: { label: 'Brand link' } }]
        }
      ]
    });

    const link = schema.flat[(schema.flat[schema.pages[0]].definition.items ?? [])[0]];

    expect(link.attributes.label).toBe('Home');
    expect(link.definition.label).toBe('Brand link');
  });

  it('hands back what was survivable rather than swallowing it', () => {
    const { warnings } = authorSpace(minimal());

    expect(Array.isArray(warnings)).toBe(true);
  });
});
describe('authorSpace / breakpoints and fonts', () => {
  /**
   * Tablet and mobile are separate ranges and mobile inherits desktop, so a tablet rule with no mobile counterpart
   * hands phones the desktop layout back — found on a real space as two columns on a 390px screen.
   */
  it('warns about a tablet rule a phone never sees, naming the properties', () => {
    const { warnings } = authorSpace(
      minimal({
        classes: {
          cards: {
            desktop: { display: 'flex' },
            tablet: { 'flex-direction': 'column', 'row-gap': '8px' },
            mobile: { 'row-gap': '8px' }
          }
        }
      })
    );
    const skipped = warnings.filter(warning => warning.code === 'tablet-rule-skips-mobile');

    expect(skipped).toHaveLength(1);
    expect(skipped[0].message).toContain('Class "cards" sets flex-direction for tablet but not for mobile');
    expect(skipped[0].details).toEqual({ properties: ['flex-direction'] });
  });

  it('says nothing once mobile repeats what tablet set', () => {
    const { warnings } = authorSpace(
      minimal({
        classes: { cards: { tablet: { 'flex-direction': 'column' }, mobile: { 'flex-direction': 'column' } } }
      })
    );

    expect(warnings.filter(warning => warning.code === 'tablet-rule-skips-mobile')).toEqual([]);
  });

  it('says nothing of a rule hidden on a phone, where no tablet rule could show', () => {
    const { warnings } = authorSpace(
      minimal({ classes: { nav: { tablet: { gap: '8px', 'font-size': '14px' }, mobile: { display: 'none' } } } })
    );

    expect(warnings.filter(warning => warning.code === 'tablet-rule-skips-mobile')).toEqual([]);
  });

  /**
   * A provider left at "Container Tag: None" renders its children and no element of its own, so a style on it dresses
   * nothing — found on real spaces as a counter card with no card, a sticky sidebar that did not stick, and analytics
   * sections that lost the gap between them. The rule is the schema's, so builder exports and the MCP see it too.
   */
  it('warns about a provider with a style and no tag to wear it', () => {
    const provider = (attributes: Record<string, unknown>, css?: ElementSpec['css']): ElementSpec => ({
      type: 'apiContainer',
      id: 'feed',
      attributes,
      ...(css ? { css } : {})
    });
    const warningsFor = (element: ElementSpec) =>
      authorSpace(minimal({ pages: [{ name: 'Home', slug: '', body: [element] }] })).warnings.filter(
        warning => warning.code === 'STYLE_WITHOUT_TAG'
      );

    const untagged = warningsFor(provider({}, { desktop: { position: 'absolute' } }));

    expect(untagged).toHaveLength(1);
    expect(untagged[0].elementId).toBe('feed');
    expect(warningsFor(provider({ subType: 'div' }, { desktop: { position: 'absolute' } }))).toEqual([]);
    expect(warningsFor(provider({}))).toEqual([]);
  });

  /** The page server loads exactly the faces the style document lists, so declaring one is what makes it load. */
  it('carries the fonts a space declares into the style the page server loads them from', () => {
    const fonts: NonNullable<SpaceSpec['fonts']> = [
      { source: 'google', family: 'Fraunces', fallback: 'Georgia, serif', weights: [400, 600], styles: ['normal'] }
    ];

    expect(authorSpace(minimal({ fonts })).style.fonts).toEqual(fonts);
    expect(authorSpace(minimal()).style.fonts).toEqual([]);
  });

  /** A face with nothing to fall back on renders in whatever the browser picks, and nothing reports it. */
  it('refuses a font the page server could not use, naming it', () => {
    const fonts: NonNullable<SpaceSpec['fonts']> = [
      { source: 'google', family: 'Fraunces', fallback: '', weights: [400], styles: ['normal'] }
    ];

    expect(() => authorSpace(minimal({ fonts }))).toThrow('Font 0 ("Fraunces")');
  });
});
describe('validateSpace', () => {
  it('accepts what authorSpace produced', () => {
    const authored = authorSpace(minimal());

    expect(validateSpace(authored).valid).toBe(true);
  });

  it('reports a style rule nobody could edit, wherever in the style it sits', () => {
    const authored = authorSpace(minimal());
    authored.style.platform.desktop.rogue = {
      name: 'rogue',
      type: 'class',
      // The cast is the test: a property outside the vocabulary is exactly what the compiler cannot catch in a
      // document that arrived as JSON, and what the validator has to.
      attributes: { base: { default: { 'font-smoothing': 'antialiased' } as StyleObject } },
      cache: ''
    };

    const { valid, errors } = validateSpace(authored);

    expect(valid).toBe(false);
    expect(errors[0].code).toBe('UNKNOWN_CSS_PROPERTY');
  });

  it('reports a flow whose chain points at a node that is not there', () => {
    const authored = authorSpace(minimal());
    const page = authored.schema.flat[authored.schema.pages[0]];
    page.definition.interactions = {
      a: {
        id: 'a',
        title: 'onClick',
        type: 'trigger',
        action: 'onClick',
        params: {},
        preview: {},
        elementId: null,
        beforeNode: '',
        afterNode: 'gone',
        flowId: 'a',
        enabled: true
      }
    };

    expect(validateSpace(authored).errors.map(error => error.code)).toContain('BROKEN_FLOW_LINK');
  });
});
describe('authorSpace / flows', () => {
  it('fires a trigger on the element it was declared on, without being told twice', () => {
    const { schema } = authorSpace({
      name: 'Flowed',
      permanentUrl: 'flowed',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            {
              type: 'button',
              id: 'cta',
              attributes: { content: 'Go' },
              flows: [
                [
                  { type: 'trigger', action: 'onClick' },
                  { type: 'globalCallback', action: 'setState', on: 'state', params: { key: 'gone', value: true } },
                  { type: 'utility', action: 'delayTime', params: { time: 200 } },
                  { type: 'callback', action: 'setState', params: { category: 'attribute', key: 'content' } }
                ]
              ]
            }
          ]
        }
      ]
    });

    const button = schema.flat[(schema.flat[schema.pages[0]].definition.items ?? [])[0]];
    const nodes = Object.values(button.definition.interactions ?? {});

    // The trigger and the element callback run against this element; the global callback names its source module,
    // and the utility runs against nothing at all.
    expect(nodes.map(node => node.elementId)).toEqual(['cta', 'state', null, 'cta']);
  });

  it('warns about a state callback key that repeats the runtime prefix without rewriting it', () => {
    const { schema, warnings } = authorSpace({
      name: 'State key',
      permanentUrl: 'state-key',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            {
              type: 'button',
              id: 'cta',
              attributes: { content: 'Choose' },
              flows: [
                [
                  { type: 'trigger', action: 'onClick' },
                  {
                    type: 'globalCallback',
                    action: 'setState',
                    on: 'state',
                    params: { key: 'state.genre', type: 'text', value: 'arcade' }
                  }
                ]
              ]
            }
          ]
        }
      ]
    });

    const warning = warnings.find(candidate => candidate.code === 'state-key-has-runtime-prefix');
    expect(warning?.details).toMatchObject({ value: 'state.genre', suggested: 'genre' });
    const button = schema.flat[schema.flat[schema.pages[0]].definition.items?.[0] ?? ''];
    const stateStep = Object.values(button.definition.interactions ?? {}).find(node => node.action === 'setState');

    // A warning is advisory: published documents and deliberate nested state keep their exact meaning.
    expect(stateStep?.params.key).toBe('state.genre');
  });
});
/**
 * Folders are a routing decision, so what is asserted is the ROUTE — a page inside one answers under its slug, and
 * `handles.path` is what a test would navigate to. Filing pages in the builder's tree is the smaller half.
 */
describe('page folders', () => {
  const withFolders = (pages: SpaceSpec['pages'], pageFolders: SpaceSpec['pageFolders']): SpaceSpec => ({
    name: 'Foldered',
    permanentUrl: 'foldered',
    pageFolders,
    pages
  });

  it('prefixes a page route with its folder, through every parent', () => {
    const { schema, handles } = authorSpace(
      withFolders(
        [
          { name: 'Home', slug: '', isDefault: true, body: [text('home')] },
          { id: 'guide', name: 'Guide', slug: 'getting-started', folder: 'docs', body: [text('guide')] },
          { id: 'ref', name: 'Reference', slug: 'elements', folder: 'api', body: [text('ref')] }
        ],
        [
          { id: 'docs', name: 'Docs', slug: 'docs' },
          { id: 'api', name: 'API', slug: 'reference', parent: 'docs' }
        ]
      )
    );

    expect(handles.page('guide').path).toBe('/docs/getting-started');
    expect(handles.page('ref').path).toBe('/docs/reference/elements');
    expect(handles.page('guide').id).toBe('guide');
    expect(schema.flat.guide.attributes.folder).toBe('docs');
    expect(schema.pageFolders).toEqual([
      { id: 'docs', name: 'Docs', slug: 'docs' },
      { id: 'api', name: 'API', slug: 'reference', parentId: 'docs' }
    ]);
  });

  it('defaults a folder name and slug to its id', () => {
    const { schema } = authorSpace(withFolders([{ name: 'Home', slug: '', body: [text('home')] }], [{ id: 'docs' }]));

    expect(schema.pageFolders).toEqual([{ id: 'docs', name: 'docs', slug: 'docs' }]);
  });

  /** A page answering at the wrong URL is not something a document can report about itself later. */
  it('refuses a page in a folder nothing declares', () => {
    expect(() =>
      authorSpace(withFolders([{ name: 'Guide', slug: 'guide', folder: 'dcos', body: [text('x')] }], [{ id: 'docs' }]))
    ).toThrow(/does not declare.*did you mean "docs"/is);
  });

  it('refuses a folder inside a folder that is not there, and one inside itself', () => {
    expect(() => authorSpace(withFolders([], [{ id: 'api', parent: 'docs' }]))).toThrow(/does not declare/);
    expect(() =>
      authorSpace(
        withFolders(
          [],
          [
            { id: 'a', parent: 'b' },
            { id: 'b', parent: 'a' }
          ]
        )
      )
    ).toThrow(/inside itself/);
  });

  // Two tasks reused room-request, room-request-message and roomRequests — three runs of the checks to find.
  it('says every name taken under a refused element at once, not one a run', () => {
    const box = (id: string, children: ElementSpec[]): ElementSpec => ({
      type: 'container',
      id,
      attributes: { subType: 'div' },
      children
    });
    const words = (id: string): ElementSpec => ({ type: 'text', id, attributes: { content: id } });
    const request = (): ElementSpec =>
      box('room-request', [words('room-request-title'), box('room-request-form', [words('room-request-message')])]);
    const refused = (() => {
      try {
        authorSpace(minimal({ pages: [{ name: 'Home', slug: '', body: [request(), request()] }] }));
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }

      return '';
    })();

    for (const id of ['room-request', 'room-request-title', 'room-request-form', 'room-request-message']) {
      expect(refused).toContain(`"${id}"`);
    }

    expect(refused).toContain('4 problems');
  });

  // A when on `roomData.role` never held and said nothing; a string where the rule group goes, no rule at all.
  it('resolves a provider’s when as a binding’s source, refusing a name nothing answers to and a when that is no group', () => {
    const provider = (when: unknown): ElementSpec => ({
      type: 'apiContainer',
      id: 'roomData',
      attributes: { query: '/data/room.json', when }
    });
    const space = (when: unknown) => minimal({ pages: [{ name: 'Home', slug: '', body: [provider(when)] }] });
    const rules = (field: string) => ({ combinator: 'and', rules: [{ field, operator: '=', value: true }] });
    const told = { sourceTypes: { apiContainer: 'apiContainer' } };
    const refusedFor = (when: unknown): string => {
      try {
        authorSpace(space(when), told);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }

      return '';
    };

    expect(refusedFor('auth.isAuthenticated')).toContain('[provider-when-not-rules]');
    expect(refusedFor(rules('rooomData.role'))).toContain('[binding-source-unknown]');
    // Its own name, short, is written whole: what the runtime reads.
    const { schema } = authorSpace(space(rules('roomData.ready')), told);
    expect(schema.flat.roomData.attributes.when).toEqual(rules('apiContainer_roomData.ready'));
  });
});
