// Packages
import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import upperFirst from 'lodash/upperFirst';
import noop from 'lodash/noop';
import get from 'lodash/get';
import startCase from 'lodash/startCase';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Input from '@plitzi/plitzi-ui-components/Input';
import Button from '@plitzi/plitzi-ui-components/Button';
import Switch from '@plitzi/plitzi-ui-components/Switch';

const nodeDefinitionsDefault = [];

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
    onChange = noop,
    onClickOpen = noop,
    onClickRemove = noop
  } = props;

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
    <div className={classNames('flex p-2', className)}>
      <div className="flex flex-col items-center justify-center">
        <div
          className={classNames(
            'flex items-center justify-center border border-gray-300 rounded-xl h-12 w-12 cursor-pointer',
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
      <div className="flex flex-col ml-2 overflow-hidden w-full">
        <div className="flex items-center">
          {!isOpened && <div className="grow basis-0 truncate">{title}</div>}
          {isOpened && (
            <Input
              size="custom"
              value={title}
              onChange={handleChangeTitle}
              inputClassName="rounded py-1 px-2 text-md"
            />
          )}
          {!nodeDefinition && elementId && (
            <i className="fa-solid fa-triangle-exclamation text-orange-400 ml-2" title="Node Not Found" />
          )}
        </div>
        <Select2
          className="rounded truncate mt-2"
          placeholder={`Select a ${upperFirst(type)}`}
          value={optionValue}
          onChange={handleChangeAction}
          options={optionsMemo}
        />
      </div>
      <div className="flex flex-col items-center justify-center ml-2">
        <Button
          intent="custom"
          size="custom"
          className="flex items-start flex items-center w-6 h-6 text-blue-400 hover:text-blue-500"
          onClick={handleClickCopyId}
          title="Copy ID"
        >
          <i className="fa-solid fa-clipboard" />
        </Button>
        {canDelete && (
          <Button
            intent="custom"
            size="custom"
            className="flex items-start flex items-center w-6 h-6 text-red-400 hover:text-red-500 mt-2"
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

NodeHeader.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  title: PropTypes.string,
  type: PropTypes.oneOf(['trigger', 'callback', 'utility', 'globalCallback']),
  action: PropTypes.string,
  elementId: PropTypes.string,
  canDelete: PropTypes.bool,
  isOpened: PropTypes.bool,
  enabled: PropTypes.bool,
  nodeDefinitions: PropTypes.array,
  nodeDefinition: PropTypes.object,
  onChange: PropTypes.func,
  onClickOpen: PropTypes.func,
  onClickPreview: PropTypes.func,
  onClickRemove: PropTypes.func
};

export default NodeHeader;
