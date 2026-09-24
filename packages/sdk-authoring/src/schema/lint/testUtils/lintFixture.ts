import {
  apiContainer,
  authorSpace,
  button,
  container,
  link,
  lintSpace,
  modalContainer,
  onClick as clicked,
  openModal,
  text
} from '../../../index';

import type { Element, ElementInteraction, Schema, Style } from '@plitzi/sdk-shared';

/**
 * The space the linter and its fixes are tested against: one the linter finds nothing in, with an element of each kind
 * a rule is about — a provider with a row inside it, a button to hang flows on, a modal and the button that opens it,
 * a link and a second page.
 */
export type Documents = { schema: Schema; style: Style };

export const authored = (): Documents => {
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
          button({ id: 'open-modal', content: 'Open', flows: [[clicked(), openModal('modal')]] }),
          modalContainer({ id: 'modal', visible: false }),
          link({ id: 'to-about', mode: 'page', href: '/about' })
        ]
      },
      { name: 'About', slug: 'about', body: [text({ id: 'about-text', content: 'About' })] }
    ]
  });

  return { schema, style };
};

export const homeId = (schema: Schema): string => schema.pages[0];

/** The space with one thing changed. */
export const withChange = (change: (documents: Documents) => void): Documents => {
  const documents = structuredClone(authored());
  change(documents);

  return documents;
};

export const errorsOf = (documents: Documents): string[] => lintSpace(documents).errors.map(issue => issue.code);
export const warningsOf = (documents: Documents): string[] => lintSpace(documents).warnings.map(issue => issue.code);

export const step = (
  id: string,
  type: string,
  action: string,
  extra: Partial<ElementInteraction> = {}
): ElementInteraction =>
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
export const setFlow = (schema: Schema, hostId: string, steps: ElementInteraction[]): void => {
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

export const onClick = () => step('click', 'trigger', 'onClick', { elementId: 'go' });

export const addElement = (schema: Schema, element: Pick<Element, 'id' | 'attributes'> & { type: string }): void => {
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

/** A form on the home page holding these controls, by id and name — a name of `undefined` is a control left unnamed. */
export const addForm = (schema: Schema, controls: Record<string, string | undefined>): void => {
  addElement(schema, { id: 'signup', type: 'form', attributes: { managedByInteractions: true } });
  for (const [id, name] of Object.entries(controls)) {
    addElement(schema, { id, type: 'formControl', attributes: name === undefined ? {} : { name } });
    const home = homeId(schema);
    schema.flat[home].definition.items = (schema.flat[home].definition.items ?? []).filter(item => item !== id);
    schema.flat[id].definition.parentId = 'signup';
    schema.flat.signup.definition.items = [...(schema.flat.signup.definition.items ?? []), id];
  }
};
