import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { apiContainer, authorSpace, component, container, lintSpace, text } from '../../index';
import { errorsOf } from './tests/lintFixture';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

describe('lintSpace', () => {
  describe('data paths', () => {
    /** A page reading a JSON file the project serves, the way a `--mode server` project does. */
    const pricing = (from: string) =>
      authorSpace({
        name: 'Pricing',
        permanentUrl: 'pricing',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [
              {
                type: 'apiContainer',
                id: 'landing',
                attributes: { query: '/data/landing.json' },
                children: [text({ id: 'first-plan', from })]
              }
            ]
          }
        ]
      });
    const file = { plans: [{ name: 'Starter' }], compare: {}, faq: [] };

    it('path-not-in-data', () => {
      const { schema, style } = pricing('landing.data.landing.plans');

      expect(
        lintSpace({ schema, style }, { data: query => (query === '/data/landing.json' ? file : undefined) }).warnings
      ).toEqual([
        expect.objectContaining({
          code: 'path-not-in-data',
          message: expect.stringContaining('apiContainer_landing.data has plans, compare, faq') as string
        })
      ]);
    });

    /** An action's provider publishes its output at its root; `.data` is a query provider's answer. */
    it('action-output-path', () => {
      const { schema, style } = authorSpace({
        name: 'Feed',
        permanentUrl: 'feed',
        pages: [
          {
            id: 'home',
            name: 'Home',
            slug: '',
            body: [
              apiContainer({
                id: 'feed',
                subType: 'section',
                runtime: 'server',
                action: 'report',
                children: [text({ id: 'count', content: '{{ apiContainer_feed.stories|length }}' })]
              })
            ]
          }
        ]
      });
      schema.flat.count.attributes.content = '{{ apiContainer_feed.data.stories|length }}';

      expect(lintSpace({ schema, style }).warnings).toEqual([
        expect.objectContaining({
          code: 'action-output-path',
          elementId: 'count',
          message: expect.stringContaining('`apiContainer_feed.stories`') as string
        })
      ]);
    });

    /** A provider's `notFound` decides the status the page is sent with: read by the page server alone. */
    const story = () =>
      authorSpace({
        name: 'Story',
        permanentUrl: 'story',
        pages: [
          {
            id: 'post',
            name: 'Post',
            slug: 'p/:slug',
            body: [
              apiContainer({
                id: 'post-data',
                runtime: 'server',
                action: 'story',
                notFound: '{{ source.found == false }}'
              })
            ]
          }
        ]
      });

    it('not-found-in-browser', () => {
      const { schema, style } = story();
      delete schema.flat['post-data'].definition.runtime;

      expect(lintSpace({ schema, style }).errors.map(error => error.code)).toContain('not-found-in-browser');
    });

    /** The browser asks a `query` alone: an `action` or a `connector` is answered by the page server, never there. */
    it('server-source-in-browser, for an action or a connector with no server runtime', () => {
      const { schema, style } = story();
      delete schema.flat['post-data'].definition.runtime;
      expect(lintSpace({ schema, style }).errors.map(error => error.code)).toContain('server-source-in-browser');

      const { attributes } = schema.flat['post-data'];
      delete attributes.action;
      attributes.connector = 'stories';
      expect(lintSpace({ schema, style }).errors.map(error => error.code)).toContain('server-source-in-browser');

      schema.flat['post-data'].definition.runtime = 'server';
      expect(lintSpace({ schema, style }).errors.map(error => error.code)).not.toContain('server-source-in-browser');
    });

    /** The page server holds a `when` it knows all of; one on what the browser alone holds it resolves regardless. */
    it('server-when-unknown, for a server provider waiting on a state', () => {
      const { schema, style } = story();
      const when = (field: string) => ({ combinator: 'and', rules: [{ field, operator: '=', value: true }] });
      schema.flat['post-data'].attributes.when = when('state.editing');
      expect(lintSpace({ schema, style }).warnings.map(warning => warning.code)).toContain('server-when-unknown');

      schema.flat['post-data'].attributes.when = when('auth.isAuthenticated');
      expect(lintSpace({ schema, style }).warnings.map(warning => warning.code)).not.toContain('server-when-unknown');
    });

    /** A written input is a value: its braces reach the action as text, over the route param it meant to read. */
    /** Only an attribute that is text is interpolated: braces inside an object or a list arrive as written. */
    it('template-in-value, for any attribute that is an object or a list', () => {
      const { schema, style } = story();
      const { attributes } = schema.flat['post-data'];
      attributes.mockData = { title: '{{ literally }}' };
      expect(lintSpace({ schema, style }).errors).toEqual([]);

      attributes.headers = { authorization: '{{ state.token }}' };
      expect(lintSpace({ schema, style }).errors).toEqual([
        expect.objectContaining({
          code: 'template-in-value',
          message: expect.stringContaining('its "headers" holds "{{ state.token }}" inside an object') as string
        })
      ]);
    });

    it('template-in-value, for a provider’s input', () => {
      const { schema, style } = story();
      const { attributes } = schema.flat['post-data'];
      attributes.input = { slug: '{{ navigation.routeParams.slug }}' };
      expect(lintSpace({ schema, style }).errors).toEqual([
        expect.objectContaining({
          code: 'template-in-value',
          elementId: 'post-data',
          message: expect.stringContaining('remove it from `input`') as string
        })
      ]);

      attributes.input = JSON.stringify({ q: '{{ state.search }}', page: 1 });
      expect(lintSpace({ schema, style }).errors).toEqual([
        expect.objectContaining({ message: expect.stringMatching(/bindTemplate\('input', 'state\.q'/) as string })
      ]);

      attributes.input = { slug: 'fixed', page: 1 };
      expect(lintSpace({ schema, style }).errors).toEqual([]);
    });

    it('not-found-not-a-template', () => {
      const { schema, style } = story();
      schema.flat['post-data'].attributes.notFound = 'true';

      expect(lintSpace({ schema, style }).errors.map(error => error.code)).toContain('not-found-not-a-template');
    });

    /** The project's own data (`src/data/`) is read by its server alone: a browser read is answered nothing. */
    it('server-data-in-browser', () => {
      const { schema, style } = pricing('landing.data.plans');
      const serverData = (query: string) => (query === '/data/landing.json' ? file : undefined);

      expect(lintSpace({ schema, style }, { serverData }).errors).toEqual([
        expect.objectContaining({
          code: 'server-data-in-browser',
          elementId: 'landing',
          message: expect.stringContaining('Give it `runtime:') as string
        })
      ]);

      schema.flat.landing.definition.runtime = 'server';
      expect(lintSpace({ schema, style }, { serverData }).errors).toEqual([]);
      // Held to the file as `data` is.
      schema.flat['first-plan'].definition.bindings = {
        attributes: [{ id: 'b', to: 'content', source: 'apiContainer_landing.data.landing.plans' }]
      };
      expect(lintSpace({ schema, style }, { serverData }).warnings.map(warning => warning.code)).toContain(
        'path-not-in-data'
      );
    });

    /** `notFound` sets the status the page is sent with, which only the page server can, before the page goes out. */
    it('not-found-in-browser', () => {
      const { schema, style } = pricing('landing.data.landing.plans');
      schema.flat.landing.attributes.notFound = '{{ source.data == null }}';

      expect(lintSpace({ schema, style }).errors.map(error => error.code)).toContain('not-found-in-browser');

      schema.flat.landing.definition.runtime = 'server';
      expect(lintSpace({ schema, style }).errors).toEqual([]);
    });

    it('not-found-not-a-template', () => {
      const { schema, style } = pricing('landing.data.landing.plans');
      schema.flat.landing.definition.runtime = 'server';
      schema.flat.landing.attributes.notFound = 'true';

      expect(lintSpace({ schema, style }).errors.map(error => error.code)).toEqual(['not-found-not-a-template']);
    });

    it('path-not-in-data is not raised for a path the answer has, or with nothing to read it against', () => {
      const { schema, style } = pricing('landing.data.plans');

      expect(lintSpace({ schema, style }, { data: () => file }).warnings).toEqual([]);
      expect(lintSpace(pricing('landing.data.landing.plans')).warnings).toEqual([]);
    });
  });
  describe('components', () => {
    /** A page placing a card that requires its title, and the card reading it. */
    const placed = () => {
      const { schema, style } = authorSpace({
        name: 'Cards',
        permanentUrl: 'cards',
        components: [
          {
            id: 'card',
            props: {
              title: { type: 'text', description: 'The heading', required: true },
              wide: { type: 'boolean', description: 'Spans the row' }
            },
            root: container({
              id: 'card-root',
              children: [text({ id: 'card-title', bind: { content: 'props.title' } })]
            })
          }
        ],
        pages: [{ name: 'Home', slug: '', body: [component('card', { id: 'card-1', props: { title: 'Lamp' } })] }]
      });

      return { schema, style };
    };

    it('finds nothing in a component placed as declared', () => {
      expect(lintSpace(placed())).toEqual({ errors: [], warnings: [] });
    });

    it('props-outside-component', () => {
      const documents = placed();
      documents.schema.flat['card-1'].definition.bindings = {
        attributes: [{ id: 'b1', to: 'title', source: 'props.title' }]
      };

      expect(errorsOf(documents)).toContain('props-outside-component');
    });

    it('prop-unknown', () => {
      const documents = placed();
      documents.schema.components.card.flat['card-title'].attributes.content = '{{ props.subtitle }}';

      expect(errorsOf(documents)).toContain('prop-unknown');
    });

    it('prop-missing', () => {
      const documents = placed();
      delete documents.schema.flat['card-1'].attributes.title;

      expect(errorsOf(documents)).toContain('prop-missing');
    });

    it('prop-value', () => {
      const documents = placed();
      documents.schema.flat['card-1'].attributes.wide = 'true';

      expect(errorsOf(documents)).toContain('prop-value');
    });

    /** The page server resolves a page's and its layouts' server elements, never one inside a component. */
    it('server-provider-in-component', () => {
      const documents = placed();
      documents.schema.components.card.flat['card-root'].definition.runtime = 'server';

      expect(errorsOf(documents)).toContain('server-provider-in-component');
    });

    it('reads a component closed: a binding onto the page it is placed on is out of its reach', () => {
      const documents = placed();
      documents.schema.components.card.flat['card-title'].attributes.content = '{{ apiContainer_feed.data }}';

      expect(errorsOf(documents)).toContain('template-unknown-name');
    });
  });
  // Reads the linter's own sources: whichever code a rule raises has to be named in a case of the lint's tests.
  it('has a case for every code the linter raises', () => {
    const folder = dirname(fileURLToPath(import.meta.url));
    const read = (name: string): string => readFileSync(join(folder, name), 'utf8');
    const self = readdirSync(folder)
      .filter(name => /^lint\..+\.test\.ts$/.test(name))
      .map(read)
      .join('\n');
    const sources = readdirSync(folder)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map(read);
    const raised = new Set(
      sources.flatMap(source => [...source.matchAll(/ctx\.(?:error|warn)\(\s*'([a-z-]+)'/g)].map(([, code]) => code))
    );

    expect(raised.size).toBeGreaterThan(0);
    expect([...raised].filter(code => !self.includes(`it('${code}`))).toEqual([]);
  });
});
