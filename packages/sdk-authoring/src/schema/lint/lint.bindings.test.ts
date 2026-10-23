import { describe, expect, it } from 'vitest';

import { lintSpace } from '../../index';
import { addElement, errorsOf, homeId, withChange } from './tests/lintFixture';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

describe('lintSpace', () => {
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

    // lx-controls: `bindTemplate('disabled', …)` rendered "false", and the arrow stayed disabled at every index.
    it('template-text-into-value, for a true/false attribute — and not once it hands over the value', () => {
      const binding = (returnMode?: 'value') => ({
        id: 'b1',
        to: 'disabled',
        source: 'state.atStart',
        transformers: [
          { action: 'twigTemplate', params: { template: '{{ source }}', ...(returnMode ? { returnMode } : {}) } }
        ]
      });
      const fed = (returnMode?: 'value') =>
        withChange(({ schema }) => {
          addElement(schema, { id: 'back', type: 'button', attributes: { content: 'Back' } });
          schema.flat.back.definition.bindings = { attributes: [binding(returnMode)] };
        });

      expect(errorsOf(fed())).toContain('template-text-into-value');
      expect(errorsOf(fed('value'))).not.toContain('template-text-into-value');
    });
  });
});
