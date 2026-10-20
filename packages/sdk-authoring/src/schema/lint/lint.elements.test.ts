import { describe, expect, it } from 'vitest';

import {
  authorSpace,
  container,
  carousel,
  elementAncestorTypes,
  elementPartTypes,
  lintSpace,
  svg,
  text
} from '../../index';
import { addElement, addForm, errorsOf, homeId, warningsOf, withChange } from './tests/lintFixture';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

describe('lintSpace', () => {
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
        schema.flat.hello.attributes.caption = 'Greeting';
      });

      expect(errorsOf(documents)).toContain('unknown-attribute');
    });

    /** A colour from data is a style binding, on a custom property the class reads. */
    it('binding-target-unknown points a style at the style category', () => {
      const written = (to: string, category?: 'style') =>
        authorSpace({
          name: 'Who',
          permanentUrl: 'who',
          pages: [
            {
              name: 'Home',
              slug: '',
              body: [container({ bind: [{ to, source: 'state.color', ...(category ? { category } : {}) }] })]
            }
          ]
        });

      expect(lintSpace(written('--who', 'style')).errors).toEqual([]);
      expect(() => written('background-color')).toThrow(/in the `style` category/);
    });

    /** A drawing with no `label` is already hidden from readers: the refusal says so rather than list attributes. */
    it('unknown-attribute says a drawing without a label is already decorative', () => {
      const { schema, style } = authorSpace({
        name: 'Mark',
        permanentUrl: 'mark',
        pages: [{ name: 'Home', slug: '', body: [svg('<svg viewBox="0 0 8 8"></svg>', { id: 'mark' })] }]
      });
      schema.flat.mark.attributes.decorative = true;

      expect(lintSpace({ schema, style }).errors).toEqual([
        expect.objectContaining({
          code: 'unknown-attribute',
          message: expect.stringContaining('already decorative') as string
        })
      ]);
    });

    it('attribute-value', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.box.attributes.subType = 'h7';
      });

      expect(errorsOf(documents)).toContain('attribute-value');
    });

    /** An `ol` is a list's tag, not a container's typo of `dl` — and a list's rows can be written out, with no data. */
    it('attribute-value names the element a tag belongs to', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.box.attributes.subType = 'ol';
      });

      expect(lintSpace(documents).errors).toEqual([
        expect.objectContaining({
          code: 'attribute-value',
          message: expect.stringMatching(
            /which is what a "list" renders: write `list\(\{ subType: 'ol' \}\)` — its rows written out, as children/
          ) as string
        })
      ]);
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

    /** A `text` renders a `<div>`: inside a `<p>` the HTML parser closes the paragraph before it, styled inline or not. */
    it('span-holds-block for a paragraph container holding a text, and not a span', () => {
      const holding = (child: 'text' | 'span') =>
        withChange(({ schema }) => {
          schema.flat.box.attributes.subType = 'p';
          addElement(schema, {
            id: 'words',
            type: child === 'text' ? 'text' : 'container',
            attributes: child === 'text' ? { content: 'Hi' } : { subType: 'span' }
          });
          const home = homeId(schema);
          schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(id => id !== 'words');
          schema.flat.words.definition.parentId = 'box';
          // The fixture's box holds a text of its own: the child under test is its only one here.
          schema.flat.box.definition.items = ['words'];
        });

      expect(warningsOf(holding('text'))).toContain('span-holds-block');
      expect(warningsOf(holding('span'))).not.toContain('span-holds-block');
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
});
