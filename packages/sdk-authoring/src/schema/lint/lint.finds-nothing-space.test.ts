import { describe, expect, it } from 'vitest';

import { authorSpace, component, container, lintSpace, list, listItem, text } from '../../index';
import {
  addElement,
  authored,
  errorsOf,
  homeId,
  onClick,
  setFlow,
  step,
  warningsOf,
  withChange
} from './tests/lintFixture';

import type { Schema } from '@plitzi/sdk-shared';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

describe('lintSpace', () => {
  it('finds nothing in a space the authoring surface wrote', () => {
    expect(lintSpace(authored())).toEqual({ errors: [], warnings: [] });
  });
  describe('pages', () => {
    it('page-access-level', () => {
      const documents = withChange(({ schema }) => {
        schema.flat[homeId(schema)].attributes.accessLevel = 'members';
      });

      expect(errorsOf(documents)).toContain('page-access-level');
    });

    it('attribute-value on a page', () => {
      const documents = withChange(({ schema }) => {
        schema.flat[homeId(schema)].attributes.documentScroll = 'fixed';
      });

      expect(errorsOf(documents)).toContain('attribute-value');
    });

    it('page-route-taken', () => {
      const documents = withChange(({ schema }) => {
        schema.flat[schema.pages[1]].attributes.slug = '';
      });

      expect(errorsOf(documents)).toContain('page-route-taken');
    });

    it('page-route-reserved', () => {
      const documents = withChange(({ schema }) => {
        schema.flat[schema.pages[1]].attributes.slug = 'fn';
      });

      expect(errorsOf(documents)).toContain('page-route-reserved');
    });

    // `/api` is a space's own to use for a page now — its functions answer under `/fn`.
    it('lets a page be at /api', () => {
      const documents = withChange(({ schema }) => {
        schema.flat[schema.pages[1]].attributes.slug = 'api';
      });

      expect(errorsOf(documents)).not.toContain('page-route-reserved');
    });

    it('page-target-unknown', () => {
      const documents = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.href = 'abuot';
      });

      expect(errorsOf(documents)).toContain('page-target-unknown');
    });

    it('page-path-unknown', () => {
      const typo = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.href = '/abuot';
      });
      const file = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.href = '/data/menu.json';
      });

      const bound = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.href = '/c/';
        schema.flat['to-about'].definition.bindings = { attributes: [{ id: 'b1', to: 'href', source: 'state.slug' }] };
      });

      expect(warningsOf(typo)).toContain('page-path-unknown');
      expect(warningsOf(file)).not.toContain('page-path-unknown');
      expect(warningsOf(bound)).not.toContain('page-path-unknown');
    });

    it('page-target-url', () => {
      const documents = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.href = 'mailto:hello@example.com';
      });

      expect(errorsOf(documents)).toContain('page-target-url');
    });
  });
  describe('computed values', () => {
    it('computed-name', () => {
      const documents = withChange(({ schema }) => {
        schema.settings.computed = { 'item count': '{{ state.items|length }}' };
      });

      expect(errorsOf(documents)).toContain('computed-name');
    });

    it('computed-not-template', () => {
      const documents = withChange(({ schema }) => {
        schema.settings.computed = { total: 'state.items' };
      });

      expect(errorsOf(documents)).toContain('computed-not-template');
    });

    it('computed-unknown', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.attributes.content = '{{ computed.total }}';
      });

      expect(errorsOf(documents)).toContain('computed-unknown');
    });

    it('computed-reads-element', () => {
      const documents = withChange(({ schema }) => {
        schema.settings.computed = { title: '{{ apiContainer_feed.data.title }}' };
      });

      expect(errorsOf(documents)).toContain('computed-reads-element');
    });
  });
  describe('flags', () => {
    const declare = (schema: Schema) => {
      schema.flags = { newCheckout: { value: false, rules: [] } };
      schema.flat.hello.definition.flag = { name: 'newCheckout', is: true };
    };

    it('reads a gated element on a declared flag as nothing to say', () => {
      expect(lintSpace(withChange(({ schema }) => declare(schema)))).toEqual({ errors: [], warnings: [] });
    });

    it('flag-name', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flags = { ...schema.flags, 'new checkout': { value: true, rules: [] } };
      });

      expect(errorsOf(documents)).toContain('flag-name');
    });

    it('flag-name on a name that is no pattern either, without throwing on it', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flags = { ...schema.flags, 'a(b': { value: true, rules: [] } };
      });

      expect(errorsOf(documents)).toContain('flag-name');
    });

    it('flag-shape', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flags = { newCheckout: { value: 'yes', rules: [] } as never };
      });

      expect(errorsOf(documents)).toContain('flag-shape');
    });

    it('flag-rule-shape', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flags = { newCheckout: { value: false, rules: [{ when: { combinator: 'and', rules: [] } }] as never } };
      });

      expect(errorsOf(documents)).toContain('flag-rule-shape');
    });

    it('flag-rule-shape on a `when` that is no group — refused, as every writer refuses it', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flags = { newCheckout: { value: false, rules: [{ when: 'always', value: true }] as never } };
      });

      expect(errorsOf(documents)).toContain('flag-rule-shape');
    });

    it('flag-rule-empty', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flags = {
          newCheckout: { value: false, rules: [{ when: { combinator: 'and', rules: [] }, value: true }] }
        };
      });

      expect(warningsOf(documents)).toContain('flag-rule-empty');
    });

    it('flag-unused', () => {
      const documents = withChange(({ schema }) => {
        schema.flags = { newCheckout: { value: false, rules: [] } };
      });

      expect(warningsOf(documents)).toContain('flag-unused');
    });

    it('flag-undeclared', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.flag = { name: 'newChekout', is: true };
      });

      expect(errorsOf(documents)).toContain('flag-undeclared');
    });

    it('flag-unknown', () => {
      const documents = withChange(({ schema }) => {
        declare(schema);
        schema.flat.hello.attributes.content = '{{ flags.newChekout }}';
      });

      expect(errorsOf(documents)).toContain('flag-unknown');
    });
  });
  describe('globals', () => {
    const errors = (documents: ReturnType<typeof withChange>, code: string) =>
      lintSpace(documents).errors.filter(issue => issue.code === code);

    /** What Inkwell wrote: `auth.authenticated`, where the source's field is `isAuthenticated`. */
    it('global-field-unknown', () => {
      const guarded = (field: string) =>
        step('notify', 'globalCallback', 'addNotification', {
          elementId: 'space',
          params: { content: 'Welcome back' },
          when: { combinator: 'and', rules: [{ field, operator: '=', value: true }] }
        });
      const inCondition = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), guarded('auth.authenticated')]);
      });
      const [condition] = errors(inCondition, 'global-field-unknown');
      expect(condition.message).toContain('the condition of step "notify" reads "auth.authenticated"');
      expect(condition.message).toContain('did you mean "auth.isAuthenticated"?');
      expect(condition.message).toContain('`auth` holds auth.isAuthenticated, auth.status, auth.accessToken');

      const inBinding = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = {
          attributes: [{ id: 'b1', to: 'content', source: 'navigation.queryParam.next' }],
          initialState: [{ id: 'b2', to: 'visibility', source: 'theme.dark' }]
        };
      });
      expect(errors(inBinding, 'global-field-unknown').map(issue => issue.message)).toEqual([
        expect.stringContaining('did you mean "navigation.queryParams"?'),
        expect.stringContaining('`theme` holds theme.mode, theme.resolved')
      ]);

      const inTemplate = withChange(({ schema }) => {
        schema.flat.hello.attributes.content = '{{ auth.details.username ?? auth.user.name }}';
      });
      const [template] = errors(inTemplate, 'global-field-unknown');
      expect(template.elementId).toBe('hello');
      expect(template.message).toContain('reads "auth.user"');

      // Below an open field anything goes, a step of the flow named like a global is that step, and a field of
      // something else that happens to be called `auth` is not the global — nor is a string that only looks like one.
      const fine = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          guarded('auth.isAuthenticated'),
          guarded('navigation.queryParams.anything'),
          guarded('auth.details.anything')
        ]);
        schema.flat.hello.attributes.content =
          "{{ state.auth.name }} {{ theme.resolved }} {{ navigation.href }} {{ 'https://auth.acme.com' }} flags.off";
        schema.flat.row.definition.bindings = {
          attributes: [{ id: 'b1', to: 'content', source: 'state.whatever.deep' }]
        };
      });
      expect(errors(fine, 'global-field-unknown')).toEqual([]);
      const ownStep = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('auth', 'globalCallback', 'login', {
            elementId: 'auth',
            params: { mode: 'normal', username: 'ada', password: 'secret' }
          }),
          guarded('auth.ok')
        ]);
      });
      expect(errors(ownStep, 'global-field-unknown')).toEqual([]);
    });

    it('flag-unknown and computed-unknown in a condition and in a binding', () => {
      const documents = withChange(({ schema }) => {
        schema.flags = { newCheckout: { value: false, rules: [] } };
        schema.settings.computed = { level: '{{ state.xp // 100 }}' };
        schema.flat.hello.definition.flag = { name: 'newCheckout', is: true };
        schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'content', source: 'computed.levl' }] };
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', {
            elementId: 'space',
            params: { content: 'New' },
            when: { combinator: 'and', rules: [{ field: 'flags.newChekout', operator: '=', value: true }] }
          })
        ]);
      });

      expect(errors(documents, 'flag-unknown')[0].message).toContain('did you mean "newCheckout"?');
      expect(errors(documents, 'computed-unknown')[0].message).toContain('did you mean "level"?');
    });
  });
  describe('anchors', () => {
    it('motion-invalid', () => {
      const documents = withChange(({ schema }) => {
        // Written as a document would arrive from a JSON file or an old builder, past the type.
        Object.assign(schema.flat.hello.definition, { motion: { enter: 'bounce', on: 'hover' } });
      });

      expect(errorsOf(documents)).toContain('motion-invalid');
    });

    it('motion-no-tag', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.subType = '';
        schema.flat.feed.definition.motion = { enter: 'fade' };
      });

      expect(errorsOf(documents)).toContain('motion-no-tag');
    });

    it('anchor-invalid', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.anchor = 'Our Plans';
      });

      expect(errorsOf(documents)).toContain('anchor-invalid');
    });

    it('anchor-no-tag', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.subType = '';
        schema.flat.feed.definition.anchor = 'feed';
      });

      expect(errorsOf(documents)).toContain('anchor-no-tag');
    });

    it('anchor-repeated', () => {
      // A component draws its tree once per instance: two cards would put the same id in the page twice.
      const documents = authorSpace({
        name: 'Cards',
        permanentUrl: 'cards',
        components: [{ id: 'card', root: container({ id: 'card-root', children: [text('Lamp')] }) }],
        pages: [{ name: 'Home', slug: '', body: [component('card', { id: 'card-1' })] }]
      });
      documents.schema.components.card.flat['card-root'].definition.anchor = 'card';

      expect(errorsOf(documents)).toContain('anchor-repeated');
    });

    it('anchor-in-row', () => {
      // In a list's rows an anchor is each row's own (`answer-<row>`): a link naming it would land at the top.
      const documents = authorSpace({
        name: 'Questions',
        permanentUrl: 'questions',
        pages: [
          {
            id: 'faq',
            name: 'FAQ',
            slug: '',
            body: [
              list({
                id: 'questions',
                items: [{ id: 'a', q: 'Why?' }],
                children: [container({ id: 'answer', anchor: 'answer', children: [text('Because')] })]
              })
            ]
          },
          { id: 'other', name: 'Other', slug: 'other', body: [container({ id: 'go', children: [text('Go')] })] }
        ]
      });
      documents.schema.flat.go.definition.type = 'link';
      Object.assign(documents.schema.flat.go.attributes, { href: 'faq', mode: 'page', hash: 'answer' });

      expect(errorsOf(documents)).toContain('anchor-in-row');

      // One row's, by its key: reached, and neither refusal.
      documents.schema.flat.go.attributes.hash = 'answer-a';
      expect(errorsOf(documents)).not.toContain('anchor-in-row');
      expect(errorsOf(documents)).not.toContain('anchor-missing');
    });

    it('anchor-duplicate', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.box.definition.anchor = 'intro';
        schema.flat.go.definition.anchor = 'intro';
      });

      expect(errorsOf(documents)).toContain('anchor-duplicate');
    });

    it('anchor-missing', () => {
      const documents = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.hash = 'team';
      });

      expect(errorsOf(documents)).toContain('anchor-missing');
    });
  });
  describe('links', () => {
    it('link-current-section', () => {
      const external = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.current = 'section';
        schema.flat['to-about'].attributes.mode = 'external';
      });
      const home = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.current = 'section';
        schema.flat['to-about'].attributes.href = homeId(schema);
      });
      const section = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.current = 'section';
      });

      expect(warningsOf(external)).toContain('link-current-section');
      expect(warningsOf(home)).toContain('link-current-section');
      expect(warningsOf(section)).not.toContain('link-current-section');
    });

    it('attribute-value on a `current` it does not take, naming the one meant', () => {
      const documents = withChange(({ schema }) => {
        schema.flat['to-about'].attributes.current = 'sections';
      });

      expect(lintSpace(documents).errors.find(issue => issue.code === 'attribute-value')?.message).toContain(
        'did you mean "section"?'
      );
    });
  });
  describe('templates', () => {
    it('template-unreadable', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = {
          attributes: [
            {
              id: 'b1',
              to: 'content',
              source: 'state.name',
              transformers: [{ action: 'twigTemplate', params: { template: '{{ source matches "^A" }}' } }]
            }
          ]
        };
      });

      expect(errorsOf(documents)).toContain('template-unreadable');
    });

    it('template-short-source', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.row.attributes.content = '{{ feed.data.title }}';
      });

      expect(errorsOf(documents)).toContain('template-short-source');

      // A list's row, named short: pointed at the name a row hands a template, not at its id written by hand.
      const row = withChange(({ schema }) => {
        addElement(schema, { id: 'rows', type: 'list', attributes: { source: 'controlled', items: [{ title: 'A' }] } });
        schema.flat.hello.attributes.content = '{{ rows.item.title }}';
      });
      const refused = lintSpace(row).errors.find(issue => issue.code === 'template-short-source');
      expect(refused?.message).toContain('r.inTemplate.item');
    });

    it('template-source-out-of-scope', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.attributes.content = '{{ apiContainer_feed.data.title }}';
      });

      expect(errorsOf(documents)).toContain('template-source-out-of-scope');
    });

    it('template-unknown-name', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.attributes.content = '{{ greeting }}';
      });

      expect(errorsOf(documents)).toContain('template-unknown-name');
    });

    /** A source named after an id with a `-` is read whole: a template takes `-` between two letters as part of a name. */
    it('template-unknown-name names a hyphenated source by its spelling, and reads it whole', () => {
      const written = (content: string) =>
        authorSpace({
          name: 'Plans',
          permanentUrl: 'plans',
          pages: [
            {
              name: 'Home',
              slug: '',
              body: [
                list({
                  id: 'study-plans',
                  items: [{ name: 'A' }],
                  children: [listItem({ children: [text({ id: 'plan-name', content })] })]
                })
              ]
            }
          ]
        });

      expect(() => written('{{ list_study_plans.item.name }}')).toThrow(
        'The source is "list_study-plans", spelled with its `-`'
      );
      expect(written('{{ list_study-plans.item.name }}').warnings).toEqual([]);
    });

    it('template-never-resolved', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.attributes.content = '{{ state.ready ? "Ready" : "Wait" }}';
      });

      expect(warningsOf(documents)).toContain('template-never-resolved');
    });
  });
});
