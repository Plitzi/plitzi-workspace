import { describe, expect, it } from 'vitest';

import * as authoring from './index';

import type { ElementSpec, StepSpec } from './index';

/**
 * The surface, in the environment it exists for.
 *
 * Every fragment is tested by the package that owns it. What only this package can answer is whether the five of
 * them compose into one import that works in Node, with no browser and nothing React anywhere near it — which is
 * the whole reason it is a package rather than a folder.
 */
describe('the authoring surface', () => {
  it('brings every fragment: elements, style, interactions and the schema that writes them', () => {
    expect(typeof authoring.heading).toBe('function');
    expect(typeof authoring.css).toBe('function');
    expect(typeof authoring.onClick).toBe('function');
    expect(typeof authoring.setState).toBe('function');
    expect(typeof authoring.authorSpace).toBe('function');
    expect(typeof authoring.validateSpace).toBe('function');
    expect(typeof authoring.authorTemplate).toBe('function');
    expect(typeof authoring.validateTemplate).toBe('function');
  });

  it('authors a space end to end, in Node, with no browser anywhere', () => {
    const { schema, style, warnings } = authoring.authorSpace({
      name: 'Smoke',
      permanentUrl: 'smoke',
      classes: { card: { padding: '24px 16px', 'border-radius': '8px' } },
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [authoring.container({ class: 'card', children: [authoring.heading('Hello', { subType: 'h2' })] })]
        }
      ]
    });

    expect(Object.keys(schema.flat)).toHaveLength(3);
    expect(style.platform.desktop.card.attributes.base.default).toMatchObject({ 'padding-top': '24px' });
    expect(warnings).toEqual([]);
  });

  it('authors a template, and it is a manifest a builder can fetch', () => {
    const { template, warnings } = authoring.authorTemplate({
      name: 'Pricing card',
      description: 'A price and a call to action.',
      classes: { card: { padding: '24px', 'border-radius': '8px' } },
      root: authoring.container({
        class: 'card',
        children: [authoring.heading('$19', { subType: 'h3' }), authoring.button({ content: 'Start' })]
      })
    });

    expect(warnings).toEqual([]);
    expect(template.schema.pages).toEqual([]);
    expect(template.schema.flat[template.definition.baseElementId].definition.parentId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(template))).toEqual(template);
  });
});

/**
 * The half of a flow no document can check about itself.
 *
 * A step names an action and the module it runs on, and the runtime resolves the pair as
 * `callbacksAvailables[<on>][<action>]`. When it names nothing the control does nothing — silently. This package is
 * where the vocabulary and the writer of documents finally meet, so it is where the pair gets held to something.
 */
describe('the step vocabulary', () => {
  const spaceWith = (flow: StepSpec[]) => ({
    name: 'Flows',
    permanentUrl: 'flows',
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [authoring.button({ id: 'go', content: 'Go', flows: [flow] })]
      }
    ]
  });

  it('accepts what the step builders write', () => {
    const authored = authoring.authorSpace(
      spaceWith([authoring.onClick(), authoring.authLogin({ mode: 'normal', username: 'ada', password: 'pw' })])
    );

    expect(authored.warnings).toEqual([]);
  });

  /** The exact shape that shipped: a real action, named on a module that never registered it. */
  it('refuses a global callback on the wrong module', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onClick(), { type: 'globalCallback', action: 'login', on: 'go' }]))
    ).toThrow(/registered on "auth"/);
  });

  /** No module at all is written into the document as `elementId: null`, which resolves to nothing. */
  it('refuses a global callback with no module', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onClick(), { type: 'globalCallback', action: 'login' }]))
    ).toThrow(/on no module/);
  });

  it('refuses a utility given a module, which is resolved by action alone', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onClick(), { type: 'utility', action: 'delayTime', on: 'go' }]))
    ).toThrow(/takes no module/);
  });

  /**
   * Warned rather than refused, and the difference matters: a plugin may register a module of its own, and a
   * process authoring a space cannot see what a browser will later load.
   */
  it('warns about an action no built-in source declares, and still authors', () => {
    const authored = authoring.authorSpace(
      spaceWith([authoring.onClick(), { type: 'globalCallback', action: 'acmeCheckout', on: 'acme' }])
    );

    expect(authored.warnings).toMatchObject([{ code: 'unknown-global-callback' }]);
    expect(Object.keys(authored.schema.flat)).toHaveLength(2);
  });

  /** An element callback and a task belong to an element type or to a server; neither is knowable here. */
  it('leaves element callbacks alone', () => {
    const authored = authoring.authorSpace(
      spaceWith([authoring.onClick(), authoring.updateElement({ category: 'attribute', key: 'content', value: 'x' })])
    );

    expect(authored.warnings).toEqual([]);
  });

  /**
   * The mistake that read as "forms do not work outside the builder": the submit flow declared on the submit
   * button. The form fires `onSubmit`; the button never does, so the flow was saved and never ran.
   */
  it('refuses a flow starting on a trigger its element never fires, and names the element that does', () => {
    expect(() =>
      authoring.authorSpace(spaceWith([authoring.onSubmit(), authoring.addNotification({ content: 'Saved' })]))
    ).toThrow(/"onSubmit", which a "button" never fires\. It is fired by "form"/);
  });

  it('accepts the triggers a type declares on top of the shared ones', () => {
    const authored = authoring.authorSpace({
      name: 'Triggers',
      permanentUrl: 'triggers',
      pages: [
        {
          name: 'Home',
          slug: '',
          flows: [[authoring.onPageLoad(), authoring.setState({ key: 'ready', type: 'boolean', value: true })]],
          body: [
            authoring.form({
              id: 'signup',
              managedByInteractions: true,
              flows: [[authoring.onSubmit(), authoring.addNotification({ content: 'Saved' })]],
              children: [authoring.formControl({ id: 'email', name: 'email', label: 'Email', subType: 'email' })]
            })
          ]
        }
      ]
    });

    expect(authored.warnings).toEqual([]);
  });

  // The second half of the same trap: on the right element, a form still has to hand its submit to the flow.
  it('warns about a submit flow on a form the browser submits natively', () => {
    const authored = authoring.authorSpace({
      name: 'Triggers',
      permanentUrl: 'triggers',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [authoring.form({ id: 'signup', flows: [[authoring.onSubmit()]] })]
        }
      ]
    });

    expect(authored.warnings).toMatchObject([{ code: 'FORM_SUBMIT_UNMANAGED', elementId: 'signup' }]);
  });

  // A modal starts open; `visible: false` is where it starts instead, and the step is what opens it.
  it('opens a modal that starts hidden from a button elsewhere on the page', () => {
    const authored = authoring.authorSpace({
      name: 'Modal',
      permanentUrl: 'modal',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            authoring.button({
              id: 'open',
              content: 'Credits',
              flows: [[authoring.onClick(), authoring.openModal('credits')]]
            }),
            authoring.modalContainer({
              id: 'credits',
              visible: false,
              children: [authoring.text({ content: 'Made by us' })]
            })
          ]
        }
      ]
    });

    expect(authored.warnings).toEqual([]);
    expect(authored.schema.flat.credits.definition.initialState).toMatchObject({ visibility: false });
  });

  /** The probe that showed it: `openModal` aimed at a plain container, which renders, saves, and opens nothing. */
  it('refuses an element callback aimed at an element that does not answer to it, and names the one that does', () => {
    expect(() =>
      authoring.authorSpace({
        name: 'Modal',
        permanentUrl: 'modal',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              authoring.button({
                id: 'open',
                content: 'Open',
                flows: [[authoring.onClick(), authoring.openModal('credits')]]
              }),
              authoring.container({ id: 'credits', visible: false })
            ]
          }
        ]
      })
    ).toThrow(
      /sends "openModal" to "credits", a "container" that never answers to it\. It is a callback of "modalContainer"/
    );
  });

  it('lets the callbacks every element answers to reach any of them, and a plugin type its own', () => {
    const authored = authoring.authorSpace({
      name: 'Callbacks',
      permanentUrl: 'callbacks',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            { type: 'acmeWidget', id: 'widget' },
            authoring.container({ id: 'panel' }),
            authoring.button({
              id: 'go',
              content: 'Go',
              flows: [
                [
                  authoring.onClick(),
                  authoring.toggleElement({ category: 'state', key: 'visibility' }, 'panel'),
                  { type: 'callback', action: 'acmeRefresh', on: 'widget' }
                ]
              ]
            })
          ]
        }
      ]
    });

    expect(authored.warnings).toEqual([]);
  });

  it('leaves the triggers of a plugin type alone, and a trigger aimed at another element', () => {
    const authored = authoring.authorSpace({
      name: 'Triggers',
      permanentUrl: 'triggers',
      pages: [
        {
          name: 'Home',
          slug: '',
          body: [
            { type: 'acmeWidget', id: 'widget', flows: [[authoring.on('onAcmeTick')]] },
            authoring.button({ id: 'go', content: 'Go', flows: [[{ ...authoring.onSubmit(), on: 'widget' }]] })
          ]
        }
      ]
    });

    expect(authored.warnings).toEqual([]);
  });
});

describe('sources read inside a flow', () => {
  /** A list of jobs, each row with a button that acts on its own job — the shape where the short name bites. */
  const listWith = (flow: StepSpec[]) => ({
    name: 'Rows',
    permanentUrl: 'rows',
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [
          authoring.apiContainer({
            id: 'board',
            runtime: 'server',
            action: 'queue-board',
            children: [
              authoring.list({
                id: 'jobRows',
                source: 'controlled',
                bind: { items: 'board.jobs' },
                children: [authoring.button({ content: 'Retry', flows: [flow] })]
              })
            ]
          })
        ]
      }
    ]
  });

  const retry = (jobId: string) =>
    authoring.named('ran', authoring.runServerAction({ actionId: 'job-retry', input: { jobId } }));

  // The binding form is completed for the author; the same short name inside a template resolves to nothing.
  it('refuses a source named the way a binding names it, and says the name it should have', () => {
    expect(() => authoring.authorSpace(listWith([authoring.onClick(), retry('{{ jobRows.item.id }}')]))).toThrow(
      /write "list_jobRows" where it says "jobRows"/
    );
  });

  it('finds it wherever it sits in the template', () => {
    expect(() =>
      authoring.authorSpace(listWith([authoring.onClick(), retry('{{ board.ready ? jobRows.item.id : "" }}')]))
    ).toThrow(/write "apiContainer_board" where it says "board"/);
  });

  it('accepts the source named in full', () => {
    const authored = authoring.authorSpace(listWith([authoring.onClick(), retry('{{ list_jobRows.item.id }}')]));

    expect(authored.warnings).toEqual([]);
  });

  // A step of the same flow is read by its own id, and may share a name with an element elsewhere on the page.
  it('leaves a root alone when it is a step of the same flow', () => {
    const flow = [
      authoring.named('board', authoring.onClick()),
      authoring.setState({ key: 'clicked', type: 'text', value: '{{ board.event }}' })
    ];

    expect(() => authoring.authorSpace(listWith(flow))).not.toThrow();
  });
});

/* eslint-disable quotes -- templates quote their own strings, and read best in the other quotes */
describe('sources read inside a binding template', () => {
  /** A card that joins its row to the stats around it — the lookup where the short name looked right and was not. */
  const cardReading = (template: string) => ({
    name: 'Cards',
    permanentUrl: 'cards',
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [
          authoring.apiContainer({
            id: 'stats',
            children: [
              authoring.text('', {
                id: 'views',
                bind: [
                  {
                    to: 'content',
                    source: 'stats.data.total',
                    transformers: [{ action: 'twigTemplate', params: { template } }]
                  }
                ]
              })
            ]
          })
        ]
      }
    ]
  });

  it('refuses a source named the way a binding names it, and says the name it should have', () => {
    expect(() => authoring.authorSpace(cardReading('{{ stats.data.total }} views'))).toThrow(
      /write "apiContainer_stats" where it says "stats"/
    );
  });

  it('finds it inside a tag too', () => {
    expect(() =>
      authoring.authorSpace(cardReading("{% set s = stats.data.rows|first %}{{ s ? s.views : '—' }}"))
    ).toThrow(/write "apiContainer_stats"/);
  });

  it('accepts the source named in full, and the `source` of the binding itself', () => {
    expect(() =>
      authoring.authorSpace(cardReading('{{ source }} of {{ apiContainer_stats.data.limit }}'))
    ).not.toThrow();
  });
});

describe('a condition written as a binding', () => {
  const spaceWith = (element: ElementSpec) => ({
    name: 'Cond',
    permanentUrl: 'cond',
    pages: [{ name: 'Home', slug: '', body: [authoring.apiContainer({ id: 'stats', children: [element] })] }]
  });

  const computed = {
    to: 'visibility',
    source: 'stats.data',
    category: 'initialState' as const,
    transformers: [{ action: 'twigTemplate', params: { template: "{{ source ? 'true' : 'false' }}" } }]
  };

  const flag = { to: 'visibility', source: 'state.layout.sidebarVisible', category: 'initialState' as const };

  const warned = (element: ElementSpec) =>
    authoring.authorSpace(spaceWith(element)).warnings.filter(warning => warning.code === 'condition-starts-visible');

  /**
   * Computed from data and drawn until the data answers: the flash of an empty state on every load. Warned rather than
   * hidden by default, because an element shown until a flag says otherwise is a shape spaces rely on.
   */
  it('warns when a computed condition starts on screen', () => {
    expect(warned(authoring.container({ id: 'empty', bind: [computed] }))).toHaveLength(1);
  });

  it('is quiet once it starts hidden, for a plain flag, and for a source known on the first render', () => {
    expect(warned(authoring.container({ id: 'empty', visible: false, bind: [computed] }))).toEqual([]);
    expect(warned(authoring.container({ id: 'logo', bind: [flag] }))).toEqual([]);
    expect(warned(authoring.container({ id: 'done', bind: [{ ...computed, source: 'state.tasks' }] }))).toEqual([]);
  });

  it('keeps an element with a plain flag on screen until the flag answers', () => {
    const authored = authoring.authorSpace(spaceWith(authoring.container({ id: 'logo', bind: [flag] })));

    expect(authored.schema.flat.logo.definition.initialState).toMatchObject({ visibility: true });
    expect(authored.handles.element('logo').conditional).toBe(true);
  });
});

describe('a template the runtime never resolves', () => {
  const pageWith = (element: ElementSpec) => ({
    name: 'Tpl',
    permanentUrl: 'tpl',
    pages: [{ name: 'Home', slug: '', body: [element] }]
  });

  const codes = (element: ElementSpec) =>
    authoring.authorSpace(pageWith(element)).warnings.filter(warning => warning.code === 'template-never-resolved');

  // An attribute resolves a name with filters, not an expression: a condition there is used as written.
  it('warns about a condition in an attribute', () => {
    expect(codes(authoring.link({ href: "/x/{{ state.on ? 'a' : 'b' }}", mode: 'internal' }))).toHaveLength(1);
  });

  it('leaves a token alone, and prose that shows one', () => {
    expect(codes(authoring.link({ href: '/x/{{ state.slug|url_encode }}', mode: 'internal' }))).toEqual([]);
    expect(codes(authoring.markdown("Write `{{ on ? 'a' : 'b' }}` in a binding."))).toEqual([]);
  });
});

/* eslint-enable quotes */

describe('a name used twice', () => {
  // Ids are one namespace for the whole space; a helper called once per page is where it bites.
  it('says where the name was taken first', () => {
    const foot = () => authoring.container({ id: 'foot' });

    expect(() =>
      authoring.authorSpace({
        name: 'Twice',
        permanentUrl: 'twice',
        pages: [
          { name: 'One', slug: '', body: [foot()] },
          { name: 'Two', slug: 'two', body: [foot()] }
        ]
      })
    ).toThrow(/uses a name already taken at .*prefixed by what it is for/);
  });
});

describe('the element catalogs', () => {
  const page = (body: ReturnType<typeof authoring.container>[]) => ({
    name: 'Menu',
    permanentUrl: 'menu',
    pages: [{ name: 'Home', slug: '', body }]
  });

  // A dropdown's panel reads the dropdown's state from context; anywhere else it throws on its first render.
  it('refuses a sub-element outside the element it only works inside', () => {
    expect(() => authoring.authorSpace(page([authoring.dropdownPopup({ id: 'panel' })]))).toThrow(
      /only works inside a "dropdown"/
    );
  });

  it('accepts it anywhere inside that element, and names the label as a child', () => {
    const authored = authoring.authorSpace(
      page([
        authoring.dropdown({
          id: 'menu',
          children: [
            authoring.text({ content: 'Menu' }),
            authoring.container({ children: [authoring.dropdownPopup({ id: 'panel' })] })
          ]
        })
      ])
    );

    expect(authored.warnings).toEqual([]);
  });

  /**
   * A space dresses a TYPE through `elements: { modalContainer: { slots: … } }`, and that style addresses the class each
   * element carries per slot. Written only for the slots an element styled itself, a modal that styled none stayed the
   * SDK's white default while the modal beside it followed the space's theme.
   */
  it('gives every element the class for each slot its type dresses', () => {
    const { schema } = authoring.authorSpace(
      page([authoring.modalContainer({ id: 'credits', visible: false, children: [authoring.text({ content: 'Hi' })] })])
    );

    expect(schema.flat.credits.definition.styleSelectors).toMatchObject({
      rootContainer: '',
      headerContainer: '',
      bodyContainer: ''
    });
  });

  it('warns about an attribute the element never reads', () => {
    const authored = authoring.authorSpace(
      page([{ type: 'dropdown', id: 'menu', attributes: { content: 'Menu' }, children: [authoring.dropdownPopup()] }])
    );

    expect(authored.warnings).toMatchObject([
      { code: 'unknown-attribute', details: { type: 'dropdown', attribute: 'content' } }
    ]);
  });
});
