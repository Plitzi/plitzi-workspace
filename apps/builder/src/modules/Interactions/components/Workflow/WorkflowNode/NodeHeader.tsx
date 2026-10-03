import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Input from '@plitzi/plitzi-ui/Input';
import Select2 from '@plitzi/plitzi-ui/Select2';
import Switch from '@plitzi/plitzi-ui/Switch';
import clsx from 'clsx';
import { useCallback, useMemo, use } from 'react';

import { nodeOptionGroups, nodeOptionValue, selectedNodeOption } from '../helpers/nodeOptions';
import { WARNING_ICON, getNodeWarnings, worstLevel } from '../helpers/nodeWarnings';
import WorkflowContext from '../WorkflowContext';

import type { NodeOption } from '../helpers/nodeOptions';
import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ElementInteraction, InteractionCallback, InteractionCallbackType } from '@plitzi/sdk-shared';
import type { ChangeEvent } from 'react';

export type NodeHeaderProps = {
  className?: string;
  id?: string;
  title?: string;
  // Shared union: server-action steps are `task` nodes and draw the same way.
  type?: InteractionCallbackType;
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
  const warnings = useMemo(
    () => getNodeWarnings({ type, action, elementId }, nodeDefinition),
    [type, action, elementId, nodeDefinition]
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
      // Option value is `${elementId}_${action}`; a utility's empty elementId would split into "undefined".
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

      // A utility registers on no element — store null, never a stringified "undefined".
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

  const triggerOptions = useMemo<NodeOption[]>(
    () =>
      type === 'trigger'
        ? (nodeDefinitions ?? [])
            .filter(definition => definition.type === 'trigger')
            .map(definition => ({
              value: nodeOptionValue(definition),
              label: definition.title,
              type: definition.type,
              elementId: definition.elementId
            }))
        : [],
    [nodeDefinitions, type]
  );

  const groups = useMemo(
    () => (type === 'trigger' ? [] : nodeOptionGroups(nodeDefinitions ?? [])),
    [nodeDefinitions, type]
  );

  const optionValue = useMemo(
    () =>
      type === 'trigger'
        ? triggerOptions.find(
            option => option.value === `${elementId}_${action}` && (option.elementId ?? '') === elementId
          )
        : selectedNodeOption(groups, type, elementId, action),
    [action, elementId, groups, triggerOptions, type]
  );

  return (
    <div className={clsx('flex gap-2 p-2', className)}>
      <div className="flex flex-col items-center justify-center">
        <div
          className={clsx(
            'flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-sm transition-colors',
            // One hue per kind of step, tinted rather than solid: the kind is read at a glance, not shouted.
            {
              'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300': type === 'trigger',
              'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300':
                type === 'callback' || type === 'globalCallback',
              'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300': type === 'utility',
              'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300': type === 'task'
            }
          )}
          onClick={onClickOpen}
        >
          {type === 'trigger' && <i className="fa-solid fa-wand-magic-sparkles" />}
          {(type === 'callback' || type === 'globalCallback') && <i className="fa-solid fa-puzzle-piece" />}
          {type === 'utility' && <i className="fa-solid fa-screwdriver-wrench" />}
          {type === 'task' && <i className="fa-solid fa-server" />}
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
          {warningLevel && (
            <i className={clsx(WARNING_ICON[warningLevel], 'ml-2')} title={warnings.map(w => w.message).join('\n')} />
          )}
          {(canUp || canDown) && (
            <div className="ml-2 flex grow basis-0 justify-end gap-1">
              {canUp && (
                <Button
                  size="xs"
                  intent="secondary"
                  border="none"
                  className="text-gray-400 hover:bg-gray-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="Move up"
                  onClick={handleClickUp}
                >
                  <i className="fa-solid fa-arrow-up" />
                </Button>
              )}
              {canDown && (
                <Button
                  size="xs"
                  intent="secondary"
                  border="none"
                  className="text-gray-400 hover:bg-gray-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  title="Move down"
                  onClick={handleClickDown}
                >
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
          options={type === 'trigger' ? triggerOptions : groups}
          size="xs"
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-1">
        <Button
          size="xs"
          intent="secondary"
          border="none"
          className="text-gray-400 hover:bg-gray-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          onClick={handleClickCopyId}
          title="Copy ID"
        >
          <Button.Icon icon="fa-solid fa-clipboard" />
        </Button>
        {canDelete && (
          <Button
            size="xs"
            intent="secondary"
            border="none"
            className="text-gray-400 hover:bg-red-50 hover:text-red-600 dark:text-zinc-500 dark:hover:bg-red-500/15 dark:hover:text-red-400"
            onClick={onClickRemove}
            title="Remove"
          >
            <Button.Icon icon="fas fa-trash-alt" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default NodeHeader;
