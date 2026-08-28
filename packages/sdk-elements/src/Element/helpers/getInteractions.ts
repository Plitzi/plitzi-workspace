import { toBuilderParams, toInteractionCallback } from '@plitzi/sdk-shared/authoring/builder';
import { BUILTIN_ELEMENT_CALLBACKS } from '@plitzi/sdk-shared/authoring/elementCallbacks';

import type {
  Element,
  InteractionCallback,
  InteractionCallbackParam,
  InteractionPostCallback
} from '@plitzi/sdk-shared';

/**
 * The callbacks every element registers on itself.
 *
 * What the action IS — its params, their defaults, which ones only apply once another is set — is declared once, in
 * `@plitzi/sdk-shared/authoring/elementCallbacks`, and read from there by the editor below and by anything authoring or validating a
 * step. What this adds is the part that can only be known here: the keys and values are THIS element's attributes
 * and style selectors, so the pickers are filled from the element in hand.
 */

/** Which fields the `key` picker offers, which is the one thing both actions ask the element itself. */
const keyOptions =
  (attributes: Element['attributes'], definition: Element['definition']) => (nodeParams: Record<string, unknown>) => {
    const { category } = nodeParams;
    if (category === 'attribute') {
      return Object.keys(attributes).map(attribute => ({ value: attribute, label: attribute }));
    }

    if (category === 'state') {
      return [
        { value: 'visibility', label: 'Visibility' },
        ...Object.keys(definition.styleSelectors).map(styleSelector => ({
          value: `styleSelectors.${styleSelector}`,
          label: `Selector - ${styleSelector}`
        }))
      ];
    }

    return [];
  };

const getInteractions = (
  attributes: Element['attributes'],
  definition: Element['definition'],
  callback: InteractionCallback['callback'],
  postCallback: InteractionPostCallback,
  toggleCallback: InteractionCallback['callback']
): Record<string, InteractionCallback> => {
  const declared = BUILTIN_ELEMENT_CALLBACKS.setState;
  const params = toBuilderParams(declared.params);
  const declaredToggle = BUILTIN_ELEMENT_CALLBACKS.toggleState;
  const toggleParams = toBuilderParams(declaredToggle.params);
  const key = {
    type: 'select',
    options: keyOptions(attributes, definition),
    when: (nodeParams: Record<string, unknown>) =>
      nodeParams.category === 'attribute' || nodeParams.category === 'state'
  };

  return {
    // Assembled by the same adapter every other declared action goes through. What is overridden is what only
    // this call can know: the element it names, the machinery's own undo hook, and the pickers below.
    setState: toInteractionCallback('setState', declared, callback, {
      title: `Update ${definition.label}`,
      postCallback,
      params: {
        ...params,
        key: { ...params.key, ...key } as InteractionCallbackParam,
        value: {
          ...params.value,
          // A boolean attribute is picked rather than typed: the stored value has to be a real boolean, and a text
          // box is how it ends up being the string "true".
          type: nodeParams => (typeof attributes[nodeParams.key as string] === 'boolean' ? 'select' : 'text'),
          options: nodeParams => {
            const { key: paramKey } = nodeParams;
            if (typeof attributes[paramKey as string] === 'boolean') {
              return [
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' }
              ];
            }

            return Object.keys(attributes).map(attribute => ({ value: attribute, label: attribute }));
          }
        }
      }
    }),
    // The same write with no `value` to author: what it stores is the opposite of what is there, which is what makes
    // expand-and-collapse one step on one trigger instead of two branches under complementary conditions.
    toggleState: toInteractionCallback('toggleState', declaredToggle, toggleCallback, {
      title: `Toggle ${definition.label}`,
      postCallback,
      params: { ...toggleParams, key: { ...toggleParams.key, ...key } as InteractionCallbackParam }
    })
  };
};

export default getInteractions;
