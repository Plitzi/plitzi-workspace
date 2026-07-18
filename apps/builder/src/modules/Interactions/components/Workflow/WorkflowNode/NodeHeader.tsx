import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import Switch from '@plitzi/plitzi-ui/Switch';
import clsx from 'clsx';
import { useCallback, useMemo, use } from 'react';

import { WARNING_ICON, getNodeWarnings, isTargetUnreferenced, worstLevel } from '../helpers/nodeWarnings';
import WorkflowContext from '../WorkflowContext';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ElementInteraction, InteractionCallback } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type NodeHeaderProps = {
  className?: string;
  id?: string;
  title?: string;
  type?: 'trigger' | 'callback' | 'utility' | 'globalCallback';
  action?: string;
  elementId?: string;
  canDelete?: boolean;
  isOpened?: boolean;
  enabled?: boolean;
  nodeDefinitions?: InteractionCallback[];
  nodeDefinition?: InteractionCallback;
  canUp?: boolean;
  canDown?: boolean;
  onChange?: (node: Partial<ElementInteraction>) => void;
  onClickOpen?: () => void;
  onClickRemove?: () => void;
};

const NodeHeader = ({
  className = '',
  id = '',
  title = 'Title',
  type = 'callback',
  action = '',
  elementId = '',
  canDelete = false,
  isOpened = false,
  enabled = false,
  nodeDefinitions,
  nodeDefinition,
  canUp = false,
  canDown = false,
  onChange,
  onClickOpen,
  onClickRemove
}: NodeHeaderProps) => {
  const { moveNode } = use(WorkflowContext);
  // The node's target has no idRef when the element it points at is one of the flagged, unreferenced entries.
  const targetUnreferenced = isTargetUnreferenced({ elementId }, nodeDefinitions);
  const warnings = useMemo(
    () => getNodeWarnings({ type, action, elementId }, nodeDefinition, targetUnreferenced),
    [type, action, elementId, nodeDefinition, targetUnreferenced]
  );
  const warningLevel = worstLevel(warnings);

  const handleClickUp = useCallback(() => moveNode(id, 'up'), [id, moveNode]);

  const handleClickDown = useCallback(() => moveNode(id, 'down'), [id, moveNode]);

  const handleChangeAction = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      if (!option) {
        onChange?.({ action: '', elementId: '', params: {}, preview: {} });

        return;
      }

      const {
        value,
        type,
        elementId: optionElementId
      } = option as Exclude<Option, OptionGroup> & {
        type: string;
        elementId?: string;
      };
      // The option value is `${elementId}_${action}`; a utility definition has no elementId, so its value starts with
      // an empty segment. Read the action from the value and take the target from the option itself (never the split
      // string, which would stringify an absent elementId as the text "undefined").
      const action = value.split('_').slice(1).join('_');
      if (!action) {
        return;
      }

      const nodeDefinition = nodeDefinitions?.find(
        definition =>
          definition.type === type &&
          (!definition.elementId || definition.elementId === optionElementId) &&
          definition.action === action
      );
      if (!nodeDefinition) {
        return;
      }

      const { params } = nodeDefinition;
      const paramsParsed = Object.keys(params).reduce(
        (acum, paramKey) => ({ ...acum, [paramKey]: get(params, `${paramKey}.defaultValue`, '') }),
        {}
      );

      // A utility (any definition with no elementId) is registered on no element — store null, never the stringified
      // "undefined" that the split value would carry.
      onChange?.({
        action,
        elementId: nodeDefinition.elementId ?? null,
        params: paramsParsed,
        preview: {},
        type: nodeDefinition.type
      });
    },
    [nodeDefinitions, onChange]
  );

  const handleChangeTitle = useCallback((value: string) => onChange?.({ title: value }), [onChange]);

  const handleChangeEnabled = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange?.({ enabled: e.target.checked }),
    [onChange]
  );

  const handleClickCopyId = useCallback(() => {
    if (typeof window !== 'undefined') {
      void navigator.clipboard.writeText(id);
    }
  }, [id]);

  const optionsMemo = useMemo<Option[]>(() => {
    if (!nodeDefinitions) {
      return [];
    }

    if (type === 'trigger') {
      return Object.values(nodeDefinitions)
        .filter(node => node.type === type)
        .map(nodeDefinition => {
          const { title, action, type, elementId } = nodeDefinition;

          return { value: `${elementId ?? ''}_${action}`, label: title, type, elementId };
        });
    }

    return Object.values(nodeDefinitions)
      .filter(node => node.type !== 'trigger')
      .reduce<(Option & { type: string; options: Option[] })[]>((acum, nodeDef) => {
        const { title, elementId, action, type } = nodeDef;
        const label = nodeDef.unreferenced ? `${title} (no Reference)` : title;
        // A utility definition has no elementId; encode it as an empty segment, never the text "undefined".
        const value = `${elementId ?? ''}_${action}`;
        const group = acum.find(node => node.type === nodeDef.type);
        if (group) {
          group.options.push({ value, label, type, elementId });

          return acum;
        }

        return [
          ...acum,
          { type, label: type, options: [{ value, label, type, elementId, disabled: nodeDef.unreferenced ?? false }] }
        ];
      }, []);
  }, [nodeDefinitions, type]);

  const optionValue = useMemo<Exclude<Option, OptionGroup> | undefined>(() => {
    // Normalize a stringified nullish target (legacy "undefined"/"null") to empty so the option still matches.
    const targetKey = elementId && elementId !== 'undefined' && elementId !== 'null' ? elementId : '';
    if (type === 'trigger') {
      return (optionsMemo as Exclude<Option, OptionGroup>[]).find(
        option => option.value === `${targetKey}_${action}` && (option.elementId ?? '') === targetKey
      );
    }

    const group = (optionsMemo as Exclude<Option, OptionGroup>[]).find(group => group.type === type);
    if (!group) {
      return undefined;
    }

    if (type === 'callback') {
      return (group.options as Exclude<Option, OptionGroup>[]).find(
        option => option.value === `${targetKey}_${action}` && (option.elementId ?? '') === targetKey
      );
    }

    return (group.options as Exclude<Option, OptionGroup>[]).find(option => option.value === `${targetKey}_${action}`);
  }, [optionsMemo, elementId, action, type]);

  return (
    <div className={clsx('flex gap-2 p-2', className)}>
      <div className="flex flex-col items-center justify-center">
        <div
          className={clsx(
            'flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border border-gray-300 dark:border-zinc-600',
            {
              'bg-blue-400 text-white': type === 'trigger',
              'bg-purple-400 text-white': type === 'callback' || type === 'globalCallback',
              'bg-orange-400 text-white': type === 'utility'
            }
          )}
          onClick={onClickOpen}
        >
          {type === 'trigger' && <i className="fa-solid fa-wand-magic-sparkles" />}
          {(type === 'callback' || type === 'globalCallback') && <i className="fa-solid fa-puzzle-piece" />}
          {type === 'utility' && <i className="fa-solid fa-screwdriver-wrench" />}
        </div>
        <Switch
          checked={enabled}
          size="sm"
          className="mt-1 flex items-center justify-center"
          onChange={handleChangeEnabled}
        />
      </div>
      <div className="flex w-full flex-col justify-between overflow-hidden">
        <div className="flex grow items-center">
          {!isOpened && (
            <div className="flex h-7 w-full items-center text-xs">
              <div className="truncate">{title}</div>
            </div>
          )}
          {isOpened && <Input size="xs" className="w-full" value={title} onChange={handleChangeTitle} />}
          {targetUnreferenced && (
            <i
              className="fa-solid fa-link-slash ml-2 text-orange-400"
              title="This element has no Reference, so the runtime cannot wire this step — give it one in Settings"
            />
          )}
          {!targetUnreferenced && warningLevel && (
            <i className={clsx(WARNING_ICON[warningLevel], 'ml-2')} title={warnings.map(w => w.message).join('\n')} />
          )}
          {(canUp || canDown) && (
            <div className="ml-2 flex grow basis-0 justify-end gap-1">
              {canUp && (
                <Button size="custom" className="rounded-sm px-1.5 py-1 text-xs" title="Up" onClick={handleClickUp}>
                  <i className="fa-solid fa-arrow-up" />
                </Button>
              )}
              {canDown && (
                <Button size="custom" className="rounded-sm px-1.5 py-1 text-xs" title="Down" onClick={handleClickDown}>
                  <i className="fa-solid fa-arrow-down" />
                </Button>
              )}
            </div>
          )}
        </div>
        <Select2
          className="truncate rounded-sm"
          placeholder={`Select a ${type}`}
          value={optionValue}
          onChange={handleChangeAction}
          options={optionsMemo}
          size="xs"
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-2">
        <Button size="xs" onClick={handleClickCopyId} title="Copy ID">
          <Button.Icon icon="fa-solid fa-clipboard" />
        </Button>
        {canDelete && (
          <Button intent="danger" size="xs" onClick={onClickRemove} title="Remove">
            <Button.Icon icon="fas fa-trash-alt" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default NodeHeader;
