import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { InteractionCallback, InteractionCallbackType } from '@plitzi/sdk-shared';

/** One step the picker offers, with what it takes to find its definition again once picked. */
export type NodeOption = Exclude<Option, OptionGroup> & { type: InteractionCallbackType; elementId?: string };

/** A heading of the picker and the steps under it — all of one type, though one type may have several headings. */
export type NodeOptionGroup = { type: InteractionCallbackType; label: string; options: NodeOption[] };

const TYPE_LABELS: Record<InteractionCallbackType, string> = {
  trigger: 'Triggers',
  callback: 'Callbacks',
  globalCallback: 'Global callbacks',
  utility: 'Utilities',
  task: 'Tasks'
};

/** A step's value in the picker: `${elementId}_${action}`, an empty segment for a step on no element. */
export const nodeOptionValue = (definition: Pick<InteractionCallback, 'elementId' | 'action'>): string =>
  `${definition.elementId ?? ''}_${definition.action}`;

/**
 * Every step but the triggers, under its heading: its own `group` when it has one — a space's functions are tasks to
 * the run, and a category of their own to whoever picks one — or its type's.
 */
export const nodeOptionGroups = (definitions: readonly InteractionCallback[]): NodeOptionGroup[] =>
  definitions
    .filter(definition => definition.type !== 'trigger')
    .reduce<NodeOptionGroup[]>((groups, definition) => {
      const label = definition.group ?? TYPE_LABELS[definition.type];
      const option: NodeOption = {
        value: nodeOptionValue(definition),
        label: definition.title,
        type: definition.type,
        elementId: definition.elementId
      };
      const group = groups.find(entry => entry.label === label);
      if (group) {
        group.options.push(option);

        return groups;
      }

      return [...groups, { type: definition.type, label, options: [option] }];
    }, []);

/** The option a node is set to, looked for under every heading of its type. */
export const selectedNodeOption = (
  groups: readonly NodeOptionGroup[],
  type: InteractionCallbackType,
  elementId: string,
  action: string
): NodeOption | undefined =>
  groups
    .filter(group => group.type === type)
    .flatMap(group => group.options)
    .find(option => option.value === `${elementId}_${action}` && (option.elementId ?? '') === elementId);
