import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUILTIN_GLOBAL_CALLBACKS, elementAncestorTypes, lintSpace } from '../../index';
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

    it('server-data-without-rsc', () => {
      const documents = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
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

    it('server-data-without-rsc is not raised once the space turns server data on, or for a browser provider', () => {
      const serverOn = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
        schema.flat.feed.definition.runtime = 'server';
        schema.rsc = { enabled: true };
      });
      const browser = withChange(({ schema }) => {
        schema.flat.feed.attributes.connector = 'crm';
        schema.rsc = { enabled: false };
      });

      expect(warningsOf(serverOn)).not.toContain('server-data-without-rsc');
      expect(warningsOf(browser)).not.toContain('server-data-without-rsc');
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

  describe('style', () => {
    it('colour-without-dark', () => {
      const documents = withChange(({ style }) => {
        style.variables.color = { ...style.variables.color, ink: { light: '#111111', default: '#111111' } };
      });

      expect(warningsOf(documents)).toContain('colour-without-dark');
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
