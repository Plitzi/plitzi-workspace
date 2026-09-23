import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BUILTIN_GLOBAL_CALLBACKS,
  apiContainer,
  authorSpace,
  button,
  container,
  elementAncestorTypes,
  link,
  lintSpace,
  modalContainer,
  text
} from '../../index';

import type { Element, ElementInteraction, Schema, Style } from '@plitzi/sdk-shared';

/**
 * Every rule of the linter, pinned by its code.
 *
 * The code is the contract: the builder groups its problems panel by it, the MCP reports it, and a fix is keyed on it.
 * Each case starts from a space the linter finds nothing in, changes the one thing the rule is about, and says whether
 * that is refused or warned. The last test holds the file to the linter: a rule added without a case here fails it.
 */

type Documents = { schema: Schema; style: Style };

const authored = (): Documents => {
  const { schema, style } = authorSpace({
    name: 'Lint',
    permanentUrl: 'lint',
    pages: [
      {
        name: 'Home',
        slug: '',
        body: [
          container({ id: 'box', children: [text({ id: 'hello', content: 'Hi' })] }),
          apiContainer({
            id: 'feed',
            subType: 'div',
            query: '/data/feed.json',
            children: [text({ id: 'row', bind: { content: 'feed.data.title' } })]
          }),
          button({ id: 'go', content: 'Go' }),
          modalContainer({ id: 'modal', visible: false }),
          link({ id: 'to-about', mode: 'page', href: '/about' })
        ]
      },
      { name: 'About', slug: 'about', body: [text({ id: 'about-text', content: 'About' })] }
    ]
  });

  return { schema, style };
};

const homeId = (schema: Schema): string => schema.pages[0];

/** The space with one thing changed. */
const withChange = (change: (documents: Documents) => void): Documents => {
  const documents = structuredClone(authored());
  change(documents);

  return documents;
};

const errorsOf = (documents: Documents): string[] => lintSpace(documents).errors.map(issue => issue.code);
const warningsOf = (documents: Documents): string[] => lintSpace(documents).warnings.map(issue => issue.code);

const step = (id: string, type: string, action: string, extra: Partial<ElementInteraction> = {}): ElementInteraction =>
  ({
    id,
    title: action,
    type,
    action,
    params: {},
    preview: {},
    elementId: null,
    beforeNode: '',
    afterNode: '',
    flowId: '',
    enabled: true,
    ...extra
  }) as ElementInteraction;

/** One flow on `hostId`, its steps linked in the order given — the shape the runtime reads. */
const setFlow = (schema: Schema, hostId: string, steps: ElementInteraction[]): void => {
  const [head] = steps;
  schema.flat[hostId].definition.interactions = Object.fromEntries(
    steps.map((node, index) => [
      node.id,
      {
        ...node,
        flowId: head.id,
        beforeNode: index > 0 ? steps[index - 1].id : '',
        afterNode: index < steps.length - 1 ? steps[index + 1].id : ''
      }
    ])
  );
};

const onClick = () => step('click', 'trigger', 'onClick', { elementId: 'go' });

const addElement = (schema: Schema, element: Pick<Element, 'id' | 'attributes'> & { type: string }): void => {
  const home = homeId(schema);
  schema.flat[element.id] = {
    id: element.id,
    attributes: element.attributes,
    definition: {
      type: element.type,
      label: element.type,
      rootId: home,
      parentId: home,
      items: [],
      styleSelectors: { base: '' }
    }
  };
  schema.flat[home].definition.items = [...(schema.flat[home].definition.items ?? []), element.id];
};

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
