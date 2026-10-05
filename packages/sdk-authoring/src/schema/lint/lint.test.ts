import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BUILTIN_GLOBAL_CALLBACKS,
  apiContainer,
  authorSpace,
  button,
  component,
  container,
  carousel,
  elementAncestorTypes,
  elementPartTypes,
  lintSpace,
  list,
  listItem,
  text
} from '../../index';
import {
  addElement,
  addForm,
  authored,
  errorsOf,
  homeId,
  onClick,
  setFlow,
  step,
  warningsOf,
  withChange
} from './testUtils/lintFixture';

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
      const documents = withChange(({ schema }) => {
        schema.flat.box.definition.type = 'list';
        schema.flat.hello.definition.anchor = 'hello';
      });

      expect(errorsOf(documents)).toContain('anchor-repeated');
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

  describe('bindings', () => {
    it('binding-category', () => {
      const documents = withChange(({ schema }) => {
        // A category the type does not have: a stored document can carry one, which is why the linter checks.
        (schema.flat.hello.definition as { bindings?: unknown }).bindings = {
          attribute: [{ id: 'b1', to: 'content', source: 'state.name' }]
        };
      });

      expect(errorsOf(documents)).toContain('binding-category');
    });

    it('binding-source-out-of-scope', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = {
          attributes: [{ id: 'b1', to: 'content', source: 'apiContainer_feed.data.title' }]
        };
      });

      expect(errorsOf(documents)).toContain('binding-source-out-of-scope');
    });

    // What the runtime walks: past the page, only the layout around the slot it renders in — not a provider beside it.
    it('binding-source-out-of-scope reaches the layout around the slot, and nothing beside it', () => {
      const withShell = (source: string) =>
        withChange(({ schema }) => {
          const shell = (id: string, type: string, parentId: string | undefined, items: string[] = []) => ({
            id,
            attributes: type === 'apiContainer' ? { subType: 'div', query: '/data/nav.json' } : {},
            definition: { type, label: id, rootId: 'shell', parentId, items, styleSelectors: { base: '' } }
          });
          schema.flat.shell = shell('shell', 'layoutContainer', undefined, ['nav', 'frame']);
          schema.flat.nav = shell('nav', 'apiContainer', 'shell');
          schema.flat.frame = shell('frame', 'apiContainer', 'shell', ['slot']);
          schema.flat.slot = shell('slot', 'container', 'frame');
          schema.flat[homeId(schema)].attributes = {
            ...schema.flat[homeId(schema)].attributes,
            layout: 'shell',
            layoutContainer: 'slot'
          };
          schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'content', source }] };
        });

      expect(errorsOf(withShell('apiContainer_frame.data.title'))).not.toContain('binding-source-out-of-scope');
      expect(errorsOf(withShell('apiContainer_nav.data.title'))).toContain('binding-source-out-of-scope');
    });

    it('binding-target-unknown', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'data-name', source: 'state.name' }] };
      });

      expect(errorsOf(documents)).toContain('binding-target-unknown');
    });

    it('binding-target-unknown leaves className bindable: every element hands it to its root', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'className', source: 'state.tone' }] };
      });

      expect(lintSpace(documents).errors).toEqual([]);
    });

    it('visibility-as-attribute', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = { attributes: [{ id: 'b1', to: 'visibility', source: 'state.open' }] };
      });

      expect(errorsOf(documents)).toContain('visibility-as-attribute');
    });

    it('unknown-transformer', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = {
          attributes: [
            {
              id: 'b1',
              to: 'content',
              source: 'state.name',
              transformers: [{ action: 'template', params: { template: '{{ source }}' } }]
            }
          ]
        };
      });

      expect(errorsOf(documents)).toContain('unknown-transformer');
    });

    it('transformer-params', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = {
          attributes: [
            { id: 'b1', to: 'content', source: 'state.name', transformers: [{ action: 'twigTemplate', params: {} }] }
          ]
        };
      });

      expect(errorsOf(documents)).toContain('transformer-params');
    });

    it('template-text-into-value', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'rows', type: 'list', attributes: { source: 'controlled' } });
        schema.flat.rows.definition.bindings = {
          attributes: [
            {
              id: 'b1',
              to: 'items',
              source: 'state.rows',
              transformers: [{ action: 'twigTemplate', params: { template: '{{ source }}' } }]
            }
          ]
        };
      });

      expect(errorsOf(documents)).toContain('template-text-into-value');
    });
  });

  describe('elements', () => {
    it('outside-ancestor', () => {
      const [[type]] = Object.entries(elementAncestorTypes);
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'stray', type, attributes: {} });
      });

      expect(errorsOf(documents)).toContain('outside-ancestor');
    });

    it('part-missing', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'deck', type: 'carousel', attributes: {} });
      });

      expect(elementPartTypes.carousel).toEqual(['carouselTrack']);
      expect(elementPartTypes.tabContainer).toEqual(['tabContainerHeader', 'tabContainerBody']);
      expect(errorsOf(documents)).toContain('part-missing');
      // The factory writes the part, so what it authors is whole.
      const written = authorSpace({
        name: 'Parts',
        permanentUrl: 'parts',
        pages: [
          {
            name: 'Home',
            slug: '',
            body: [carousel({ id: 'deck', items: 'state.slides', row: r => text({ from: `${r.item}.title` }) })]
          }
        ]
      });
      expect(lintSpace(written).errors.map(issue => issue.code)).not.toContain('part-missing');
    });

    it('unknown-attribute', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.attributes.title = 'Greeting';
      });

      expect(errorsOf(documents)).toContain('unknown-attribute');
    });

    it('attribute-value', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.box.attributes.subType = 'h7';
      });

      expect(errorsOf(documents)).toContain('attribute-value');
    });

    it('span-holds-block', () => {
      const inline = withChange(({ schema }) => {
        schema.flat.box.attributes.subType = 'span';
      });
      const holdsHeading = withChange(({ schema }) => {
        schema.flat.box.attributes.subType = 'span';
        addElement(schema, { id: 'title', type: 'heading', attributes: { subType: 'h2', content: 'Hi' } });
        const home = homeId(schema);
        schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(id => id !== 'title');
        schema.flat.title.definition.parentId = 'box';
        schema.flat.box.definition.items = [...(schema.flat.box.definition.items ?? []), 'title'];
      });

      expect(errorsOf(inline)).toEqual([]);
      expect(warningsOf(inline)).not.toContain('span-holds-block');
      expect(warningsOf(holdsHeading)).toContain('span-holds-block');
    });

    /** A sentence made of parts is a `p` container; a block inside one is closed off by the browser, not nested. */
    it('span-holds-block for a paragraph container holding a block', () => {
      const holdsHeading = withChange(({ schema }) => {
        schema.flat.box.attributes.subType = 'p';
        addElement(schema, { id: 'title', type: 'heading', attributes: { subType: 'h2', content: 'Hi' } });
        const home = homeId(schema);
        schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(id => id !== 'title');
        schema.flat.title.definition.parentId = 'box';
        schema.flat.box.definition.items = [...(schema.flat.box.definition.items ?? []), 'title'];
      });

      expect(warningsOf(holdsHeading)).toContain('span-holds-block');
    });

    it('loading-slot-unknown', () => {
      const providerWith = (loadingSlot: string) =>
        errorsOf(
          withChange(({ schema }) => {
            addElement(schema, {
              id: 'catalog',
              type: 'apiContainer',
              attributes: { query: '/data/x.json', loadingSlot }
            });
            addElement(schema, { id: 'skeleton', type: 'container', attributes: {} });
            const home = homeId(schema);
            schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(
              id => id !== 'skeleton'
            );
            schema.flat.skeleton.definition.parentId = 'catalog';
            schema.flat.catalog.definition.items = ['skeleton'];
          })
        );

      expect(providerWith('skeleton')).not.toContain('loading-slot-unknown');
      expect(providerWith('skeletn')).toContain('loading-slot-unknown');
    });

    it('list-item-key-missing', () => {
      const listOf = (items: unknown[]) =>
        warningsOf(
          withChange(({ schema }) => {
            addElement(schema, {
              id: 'rows',
              type: 'list',
              attributes: { source: 'controlled', itemKey: 'slug', items }
            });
          })
        );

      expect(listOf([{ slug: 'a' }, { slug: 'b' }])).not.toContain('list-item-key-missing');
      expect(listOf([{ slug: 'a' }, { name: 'b' }])).toContain('list-item-key-missing');
      expect(listOf([{ slug: 'a' }, { slug: 'a' }])).toContain('list-item-key-missing');
    });

    it('list-row-not-li', () => {
      const rowOf = (row: { type: string; attributes: Record<string, unknown> }) =>
        warningsOf(
          withChange(({ schema }) => {
            addElement(schema, { id: 'rows', type: 'list', attributes: { source: 'controlled', items: [{ n: 1 }] } });
            addElement(schema, { id: 'row', ...row });
            const home = schema.flat.rows.definition.rootId;
            schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(id => id !== 'row');
            schema.flat.row.definition.parentId = 'rows';
            schema.flat.rows.definition.items = ['row'];
          })
        );

      expect(rowOf({ type: 'container', attributes: {} })).toContain('list-row-not-li');
      expect(rowOf({ type: 'container', attributes: { subType: 'li' } })).not.toContain('list-row-not-li');
      expect(rowOf({ type: 'listItem', attributes: {} })).not.toContain('list-row-not-li');
    });

    it('attribute-kind', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.go.attributes.disabled = 'true';
      });

      expect(errorsOf(documents)).toContain('attribute-kind');
    });

    it('element-runtime', () => {
      const documents = withChange(({ schema }) => {
        (schema.flat.feed.definition as { runtime?: string }).runtime = 'edge';
      });

      expect(errorsOf(documents)).toContain('element-runtime');
    });

    it('element-load-strategy', () => {
      const documents = withChange(({ schema }) => {
        (schema.flat.box.definition as { loadStrategy?: string }).loadStrategy = 'soon';
      });

      expect(errorsOf(documents)).toContain('element-load-strategy');
    });

    it('children-in-leaf', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.items = ['go'];
      });

      expect(errorsOf(documents)).toContain('children-in-leaf');
    });

    it('list-without-items', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'rows', type: 'list', attributes: { source: 'controlled', items: [] } });
      });

      expect(errorsOf(documents)).toContain('list-without-items');
    });

    it('list-items-ignored', () => {
      const written = withChange(({ schema }) => {
        addElement(schema, { id: 'rows', type: 'list', attributes: { source: 'none', items: [{ title: 'One' }] } });
      });
      const bound = withChange(({ schema }) => {
        addElement(schema, { id: 'rows', type: 'list', attributes: {} });
        schema.flat.rows.definition.bindings = { attributes: [{ id: 'b1', to: 'items', source: 'state.rows' }] };
      });

      expect(errorsOf(written)).toContain('list-items-ignored');
      expect(errorsOf(bound)).toContain('list-items-ignored');
    });

    it('overlay-starts-open', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.modal.definition.initialState = { visibility: true };
      });

      expect(warningsOf(documents)).toContain('overlay-starts-open');
    });

    it('provider-without-source', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.query = '';
      });

      expect(warningsOf(documents)).toContain('provider-without-source');
    });

    it('quiet-unknown on a document that quiets a problem or a misspelt code', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.quiet = ['repeated-shape', 'class-and-css'];
      });

      expect(errorsOf(documents)).toContain('quiet-unknown');
    });

    it('server-data-without-rsc', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
        schema.flat.feed.definition.runtime = 'server';
        schema.rsc = { enabled: false };
      });

      expect(warningsOf(documents)).toContain('server-data-without-rsc');
    });

    /** A provider reading one of the project's own files on the server is answered the same way: only with rsc on. */
    it('server-data-without-rsc for a server provider with a query', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.query = '/data/plans.json';
        schema.flat.feed.definition.runtime = 'server';
        schema.rsc = { enabled: false };
      });

      expect(warningsOf(documents)).toContain('server-data-without-rsc');
    });

    it('route-param-undeclared', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.hello.definition.bindings = {
          attributes: [{ id: 'slug', to: 'content', source: 'navigation.routeParams.slug' }]
        };
      });

      expect(warningsOf(documents)).toContain('route-param-undeclared');
    });

    it('route-param-undeclared is not raised when the page declares it', () => {
      const documents = withChange(({ schema }) => {
        schema.flat[homeId(schema)].attributes.slug = 'posts/:slug';
        schema.flat.hello.definition.bindings = {
          attributes: [{ id: 'slug', to: 'content', source: 'navigation.routeParams.slug' }]
        };
      });

      expect(warningsOf(documents)).not.toContain('route-param-undeclared');
    });

    it('route-param-undeclared is not raised for prose that only mentions one', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, {
          id: 'docs',
          type: 'markdown',
          attributes: { content: 'Read it with `navigation.routeParams.slug`.' }
        });
      });

      expect(warningsOf(documents)).not.toContain('route-param-undeclared');
    });

    it('form-control-unnamed', () => {
      const documents = withChange(({ schema }) => addForm(schema, { email: 'email', nameless: undefined }));

      expect(warningsOf(documents)).toContain('form-control-unnamed');
    });

    it('form-control-name-taken', () => {
      const documents = withChange(({ schema }) => addForm(schema, { email: 'email', again: 'email' }));

      expect(warningsOf(documents)).toContain('form-control-name-taken');
    });

    it('form controls with a name each are not warned about', () => {
      const documents = withChange(({ schema }) => addForm(schema, { email: 'email', password: 'password' }));

      expect(warningsOf(documents).filter(code => code.startsWith('form-control'))).toEqual([]);
    });

    it('overlay-never-opened', () => {
      const documents = withChange(({ schema }) => {
        schema.flat['open-modal'].definition.interactions = {};
      });

      expect(warningsOf(documents)).toContain('overlay-never-opened');
    });

    it('server-data-without-rsc is not raised unless the space turns server data off, nor for a browser provider', () => {
      const serverOn = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
        schema.flat.feed.definition.runtime = 'server';
        schema.rsc = { enabled: true };
      });
      const browser = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
        schema.rsc = { enabled: false };
      });

      const unsaid = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
        schema.flat.feed.definition.runtime = 'server';
        delete schema.rsc;
      });

      expect(warningsOf(serverOn)).not.toContain('server-data-without-rsc');
      expect(warningsOf(browser)).not.toContain('server-data-without-rsc');
      expect(warningsOf(unsaid)).not.toContain('server-data-without-rsc');
    });

    /** The server resolves a provider that names a connector, so it asks something — found by an e2e fixture. */
    it('provider-without-source is not raised for a connector provider', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.query = '';
        schema.flat.feed.attributes.connector = 'crm';
      });

      expect(warningsOf(documents)).not.toContain('provider-without-source');
    });

    it('default-content-beside-children', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.go.attributes.content = 'Button';
        schema.flat.go.definition.items = ['hello'];
      });

      expect(warningsOf(documents)).toContain('default-content-beside-children');
    });

    it('condition-starts-visible', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.row.definition.bindings = {
          ...schema.flat.row.definition.bindings,
          initialState: [
            {
              id: 'b2',
              to: 'visibility',
              source: 'apiContainer_feed.data.ready',
              transformers: [{ action: 'twigTemplate', params: { template: '{{ source }}' } }]
            }
          ]
        };
      });

      expect(warningsOf(documents)).toContain('condition-starts-visible');
    });

    it('unknown-element-type', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'weather', type: 'weatherCard', attributes: {} });
      });

      expect(warningsOf(documents)).toContain('unknown-element-type');
      expect(lintSpace(documents, { pluginTypes: ['weatherCard'] }).warnings).toEqual([]);
    });
  });

  describe('flows', () => {
    const notify = BUILTIN_GLOBAL_CALLBACKS.addNotification.source;

    it('flow-without-trigger', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [step('open', 'callback', 'openModal', { elementId: 'modal' })]);
      });

      expect(errorsOf(documents)).toContain('flow-without-trigger');
    });

    it('step-type', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('odd', 'effect', 'openModal')]);
      });

      expect(errorsOf(documents)).toContain('step-type');
    });

    it('trigger-never-fired', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          step('submit', 'trigger', 'onSubmit', { elementId: 'go' }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(documents)).toContain('trigger-never-fired');
    });

    it('channel-declaration', () => {
      const withChannels = (channels: Record<string, unknown>) =>
        errorsOf(
          withChange(({ schema }) => {
            // Malformed on purpose: what a hand-edited document or an agent may write, which no type would allow.
            schema.settings.channels = channels as NonNullable<typeof schema.settings.channels>;
          })
        );

      expect(withChannels({ 'room:{id}': { access: { mode: 'public' } } })).not.toContain('channel-declaration');
      expect(withChannels({ 'room {id}': { access: { mode: 'public' } } })).toContain('channel-declaration');
      expect(withChannels({ 'room:{id}': { access: { mode: 'anyone' } } })).toContain('channel-declaration');
      expect(withChannels({ 'room:{id}': { access: { mode: 'role' } } })).toContain('channel-declaration');
      expect(withChannels({ 'room:{id}': { access: { mode: 'public' }, messagesPerSecond: 0 } })).toContain(
        'channel-declaration'
      );
    });

    it('channel-grant', () => {
      const withGrant = (attributes: Record<string, unknown>, bound = false) =>
        withChange(({ schema }) => {
          schema.settings.channels = { 'room:{id}': { access: { mode: 'public' }, grant: true } };
          addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'room:{{ id }}', ...attributes } });
          if (bound) {
            schema.flat.room.definition.bindings = {
              attributes: [{ id: 'grant-binding', to: 'grant', source: 'state.grant' }]
            };
          }
        });

      expect(errorsOf(withGrant({}))).toContain('channel-grant');
      expect(errorsOf(withGrant({ grant: 'abc' }))).not.toContain('channel-grant');
      expect(errorsOf(withGrant({}, true))).not.toContain('channel-grant');
    });

    it('channel-topic', () => {
      const undeclared = withChange(({ schema }) => {
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'board:{{ id }}' } });
      });
      const declared = withChange(({ schema }) => {
        schema.settings.channels = { 'board:{id}': { access: { mode: 'public' } } };
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: 'board:{{ id }}' } });
      });
      const empty = withChange(({ schema }) => {
        schema.settings.channels = { 'board:{id}': { access: { mode: 'public' } } };
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: '' } });
      });

      expect(errorsOf(undeclared)).toContain('channel-topic');
      expect(errorsOf(declared)).not.toContain('channel-topic');
      expect(errorsOf(empty)).toContain('channel-topic');

      // A bound topic is the page's to decide: nothing here can check it, and nothing is reported.
      const bound = withChange(({ schema }) => {
        addElement(schema, { id: 'room', type: 'channel', attributes: { topic: '' } });
        schema.flat.room.definition.bindings = {
          attributes: [{ id: 'topic-binding', to: 'topic', source: 'state.topic' }]
        };
      });
      expect(errorsOf(bound)).not.toContain('channel-topic');
    });

    it('while-running', () => {
      const onStep = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('open', 'callback', 'openModal', { elementId: 'modal', whileRunning: 'queue' })
        ]);
      });
      const unknownMode = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          // A document written outside TypeScript — the builder, the MCP, an import — can hold any string here.
          step('click', 'trigger', 'onClick', { elementId: 'go', whileRunning: 'later' as 'queue' }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(onStep)).toContain('while-running');
      expect(errorsOf(unknownMode)).toContain('while-running');
    });

    it('trigger-keys', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          step('key', 'trigger', 'onKey', { elementId: 'go', params: { keys: 'ctrl+shift' } }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(documents)).toContain('trigger-keys');
    });

    it('trigger-interval', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          step('tick', 'trigger', 'onInterval', { elementId: 'go', params: { interval: 50 } }),
          step('open', 'callback', 'openModal', { elementId: 'modal' })
        ]);
      });

      expect(errorsOf(documents)).toContain('trigger-interval');
    });

    it('state-toggled-in-branches', () => {
      const branch = (id: string, value: boolean, operator: '=' | '!=') =>
        step(id, 'globalCallback', 'setState', {
          elementId: 'state',
          params: { key: 'menuOpen', type: 'boolean', value },
          when: { combinator: 'and', rules: [{ field: 'state.menuOpen', operator, value: true }] }
        });
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), branch('close', false, '='), branch('open', true, '!=')]);
      });

      expect(warningsOf(documents)).toContain('state-toggled-in-branches');
    });

    it('form-value-compared-to-blank', () => {
      const guarded = (operator: '=' | '!=' | 'empty') =>
        step(`check-${operator}`, 'globalCallback', 'setState', {
          elementId: 'state',
          params: { key: 'problem', type: 'text', value: 'Type a code' },
          when: {
            combinator: 'and',
            rules: [{ combinator: 'or', rules: [{ field: 'sent.values.code', operator, value: '' }] }]
          }
        });
      const flagged = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), guarded('='), guarded('!=')]);
      });
      const fine = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), guarded('empty')]);
      });

      expect(warningsOf(flagged).filter(code => code === 'form-value-compared-to-blank')).toHaveLength(2);
      expect(warningsOf(fine)).not.toContain('form-value-compared-to-blank');
    });

    it('unknown-global-callback', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('teleport', 'globalCallback', 'teleport', { elementId: 'state' })]);
      });

      expect(warningsOf(documents)).toContain('unknown-global-callback');
    });

    it('global-callback-module', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', { elementId: 'go', params: { content: 'Hi' } })
        ]);
      });

      expect(errorsOf(documents)).toContain('global-callback-module');
    });

    it('step-params', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', {
            elementId: notify,
            params: { content: 'Hi', appeareance: 'success' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('step-params');
    });

    // `autoDismissTimeout` applies only while `autoDismiss` is on, and it is on by default: read as the runtime reads it.
    it('step-params on a param that applies through a default', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('notify', 'globalCallback', 'addNotification', {
            elementId: notify,
            params: { content: 'Hi', autoDismissTimeout: 'soon' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('step-params');
    });

    it('step-params on the setState every element answers to', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'attribute', key: 'content', value: 'Done', type: 'text' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('step-params');
    });

    it('unknown-utility', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('nap', 'utility', 'sleep')]);
      });

      expect(warningsOf(documents)).toContain('unknown-utility');
    });

    it('utility-module', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('wait', 'utility', 'delayTime', { elementId: 'go', params: { time: 1 } })
        ]);
      });

      expect(errorsOf(documents)).toContain('utility-module');
    });

    it('callback-not-answered', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [onClick(), step('open', 'callback', 'openModal', { elementId: 'box' })]);
      });

      expect(errorsOf(documents)).toContain('callback-not-answered');
    });

    it('callback-key-unknown, for an attribute', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'attribute', key: 'label', value: 'Done' }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('callback-key-unknown');
    });

    it('callback-key-unknown, for the state', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('show', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'state', key: 'visible', value: true }
          })
        ]);
      });

      expect(errorsOf(documents)).toContain('callback-key-unknown');
    });

    it('callback-key-unknown lets through a key the element has', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'callback', 'setState', {
            elementId: 'hello',
            params: { category: 'attribute', key: 'content', value: 'Done' }
          }),
          step('hide', 'callback', 'setState', {
            elementId: 'box',
            params: { category: 'state', key: 'visibility', value: false }
          })
        ]);
      });

      expect(lintSpace(documents).errors).toEqual([]);
    });

    it('state-key-has-runtime-prefix', () => {
      const documents = withChange(({ schema }) => {
        setFlow(schema, 'go', [
          onClick(),
          step('write', 'globalCallback', 'setState', {
            elementId: 'state',
            params: { key: 'state.name', type: 'text', value: 'Ada' }
          })
        ]);
      });

      expect(warningsOf(documents)).toContain('state-key-has-runtime-prefix');
    });
  });

  describe('svg', () => {
    it('svg-not-svg', () => {
      const documents = withChange(({ schema }) => {
        addElement(schema, { id: 'icon', type: 'svg', attributes: { content: '<div><svg></svg></div>' } });
        addElement(schema, { id: 'ok', type: 'svg', attributes: { content: '<svg viewBox="0 0 1 1"></svg>' } });
      });

      expect(errorsOf(documents)).toContain('svg-not-svg');
      expect(lintSpace(documents).errors.filter(issue => issue.code === 'svg-not-svg')).toHaveLength(1);
    });
  });

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

  // Reads the linter's own sources: whichever code a rule raises has to be named in a case above.
  it('has a case for every code the linter raises', () => {
    const folder = dirname(fileURLToPath(import.meta.url));
    const read = (name: string): string => readFileSync(join(folder, name), 'utf8');
    const self = read('lint.test.ts');
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
