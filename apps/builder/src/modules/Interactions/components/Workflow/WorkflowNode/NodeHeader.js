// Packages
import React, { useCallback, useMemo, use } from 'react';
import classNames from 'classnames';
import upperFirst from 'lodash/upperFirst';
import noop from 'lodash/noop';
import get from 'lodash/get';
import startCase from 'lodash/startCase';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Input from '@plitzi/plitzi-ui-components/Input';
import Button from '@plitzi/plitzi-ui-components/Button';
import Switch from '@plitzi/plitzi-ui-components/Switch';
import WorkflowContext from '../WorkflowContext';

const nodeDefinitionsDefault = [];

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   title?: string;
 *   type?: 'trigger' | 'callback' | 'utility' | 'globalCallback';
 *   action?: string;
 *   elementId?: string;
 *   canDelete?: boolean;
 *   isOpened?: boolean;
 *   enabled?: boolean;
 *   nodeDefinitions?: object[];
 *   nodeDefinition?: object;
 *   canUp?: boolean;
 *   canDown?: boolean;
 *   onChange?: (node: object) => void;
 *   onClickOpen?: () => void;
 *   onClickRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeHeader = props => {
  const {
    className = '',
    id = '',
    title = 'Title',
    type = 'callback',
    action = '',
    elementId = '',
    canDelete = false,
    isOpened = false,
    enabled = false,
    nodeDefinitions = nodeDefinitionsDefault,
    nodeDefinition,
    canUp = false,
    canDown = false,
    onChange = noop,
    onClickOpen = noop,
    onClickRemove = noop
  } = props;

  const { moveNode } = use(WorkflowContext);

  const handleClickUp = useCallback(() => moveNode(id, 'up'), [id, moveNode]);

  const handleClickDown = useCallback(() => moveNode(id, 'down'), [id, moveNode]);

  const handleChangeAction = useCallback(
    option => {
      if (!option) {
        onChange({ action: '', elementId: '', params: {}, preview: {} });

        return;
      }

      const { value, type } = option;
      const [elementId, action] = value.split('_');
      if (!elementId || !action) {
        return;
      }

      const nodeDefinition = nodeDefinitions.find(
        n => n.type === type && (!n.elementId || n.elementId === elementId) && n.action === action
      );
      if (!nodeDefinition) {
        return;
      }

      const { params } = nodeDefinition;
      const paramsParsed = Object.keys(params).reduce(
        (acum, paramKey) => ({ ...acum, [paramKey]: get(params, `${paramKey}.defaultValue`, '') }),
        {}
      );

      onChange({ action, elementId, params: paramsParsed, preview: {}, type });
    },
    [nodeDefinitions, onChange]
  );

  const handleChangeTitle = useCallback(e => onChange({ title: e.target.value }), [onChange]);

  const handleChangeEnabled = useCallback(e => onChange({ enabled: e.target.checked }), [onChange]);

  const handleClickCopyId = useCallback(() => {
    navigator.clipboard.writeText(id);
  }, [id]);

  const optionsMemo = useMemo(() => {
    if (type === 'trigger') {
      return Object.values(nodeDefinitions)
        .filter(node => node.type === type)
        .map(nodeDefinition => {
          const { title, action, type, elementId } = nodeDefinition;

          return { value: `${elementId}_${action}`, label: title, type, elementId };
        });
    }

    return Object.values(nodeDefinitions)
      .filter(node => node.type !== 'trigger')
      .reduce((acum, nodeDef) => {
        const { title, elementId, action, type } = nodeDef;
        const group = acum.find(node => node.type === nodeDef.type);
        if (group) {
          group.options.push({ value: `${elementId}_${action}`, label: title, type, elementId });

          return acum;
        }

        return [
          ...acum,
          {
            type,
            label: startCase(type),
            options: [{ value: `${elementId}_${action}`, label: title, type, elementId }]
          }
        ];
      }, []);
  }, [nodeDefinitions]);

  const optionValue = useMemo(() => {
    if (type === 'trigger') {
      return optionsMemo.find(option => option.value === `${elementId}_${action}` && option.elementId === elementId);
    }

    const group = optionsMemo.find(group => group.type === type);
    if (!group) {
      return null;
    }

    if (type === 'callback') {
      return group.options.find(option => option.value === `${elementId}_${action}` && option.elementId === elementId);
    }

    return group.options.find(option => option.value === `${elementId}_${action}`);
  }, [optionsMemo, elementId, action, type]);

  return (
    <div className={classNames('flex p-2 gap-2', className)}>
      <div className="flex flex-col items-center justify-center">
        <div
          className={classNames(
            'flex items-center justify-center border border-gray-300 rounded h-9 w-9 cursor-pointer',
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
          value={enabled}
          size="sm"
          className="mt-1 flex items-center justify-center"
          onChange={handleChangeEnabled}
        />
      </div>
      <div className="flex flex-col overflow-hidden w-full justify-between">
        <div className="flex items-center">
          {!isOpened && (
            <div className="grow basis-0 truncate text-sm h-7 flex items-center">
              <div className="truncate">{title}</div>
            </div>
          )}
          {isOpened && <Input size="sm" value={title} onChange={handleChangeTitle} inputClassName="rounded !text-sm" />}
          {!nodeDefinition && elementId && (
            <i className="fa-solid fa-triangle-exclamation text-orange-400 ml-2" title="Node Not Found" />
          )}
          <div className="flex ml-2 basis-0 gap-1 grow justify-end">
            {canUp && (
              <Button size="custom" className="rounded px-1.5 py-1 text-xs" title="Up" onClick={handleClickUp}>
                <i className="fa-solid fa-arrow-up" />
              </Button>
            )}
            {canDown && (
              <Button size="custom" className="rounded px-1.5 py-1 text-xs" title="Down" onClick={handleClickDown}>
                <i className="fa-solid fa-arrow-down" />
              </Button>
            )}
          </div>
        </div>
        <Select2
          className="rounded truncate"
          placeholder={`Select a ${upperFirst(type)}`}
          value={optionValue}
          onChange={handleChangeAction}
          options={optionsMemo}
          size="sm"
        />
      </div>
      <div className="flex flex-col items-center justify-center">
        <Button
          intent="custom"
          size="custom"
          className="flex items-center justify-center w-6 h-6 text-blue-400 hover:text-blue-500"
          onClick={handleClickCopyId}
          title="Copy ID"
        >
          <i className="fa-solid fa-clipboard" />
        </Button>
        {canDelete && (
          <Button
            intent="custom"
            size="custom"
            className="flex items-center justify-center w-6 h-6 text-red-400 hover:text-red-500 mt-2"
            onClick={onClickRemove}
            title="Remove"
          >
            <i className="fas fa-trash-alt" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default NodeHeader;
