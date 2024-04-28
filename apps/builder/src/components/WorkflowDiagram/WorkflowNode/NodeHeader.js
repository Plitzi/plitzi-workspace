// Packages
import React, { useCallback, use, useMemo } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui-components/Select';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import upperFirst from 'lodash/upperFirst';

// Relatives
import WorkflowContext from '../WorkflowContext';
import NodeActions from './NodeActions';

/**
 * @param {{
 *   className?: string;
 *   type?: 'trigger' | 'callback';
 *   action?: string;
 *   elementId?: string;
 *   onChange?: (node: { type: 'trigger' | 'callback'; action: string; elementId: string; params: object }) => void;
 *   onClickSelect?: () => void;
 *   onRemove?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const NodeHeader = props => {
  const {
    className = '',
    type = 'callback',
    action = '',
    elementId = '',
    onChange = noop,
    onClickSelect = noop,
    onRemove = noop
  } = props;
  const { nodeDefinitions } = use(WorkflowContext);

  const handleChangeType = useCallback(
    e => {
      e.stopPropagation();
      onChange({ type: e.target.value, action: '', elementId: '', params: {} });
    },
    [onChange]
  );

  const handleChangeAction = useCallback(
    option => {
      const { value } = option;
      let elementId = '';
      let action = value;
      if (value.includes('-')) {
        [elementId, action] = value.split('-');
      }

      const nodeDefinition = nodeDefinitions.find(definition => definition.action === action);
      if (!nodeDefinition) {
        return;
      }

      onChange({ action, elementId, params: {} });
    },
    [nodeDefinitions, onChange]
  );

  const optionsMemo = useMemo(
    () =>
      Object.values(nodeDefinitions)
        .filter(node => node.type === type)
        .map(nodeDefinition => ({
          value: `${nodeDefinition.elementId ? `${nodeDefinition.elementId}-` : ''}${nodeDefinition.action}`,
          label: nodeDefinition.title
        })),
    [nodeDefinitions]
  );

  return (
    <div className={classNames('flex flex-col p-2 w-full', className)}>
      <div className="flex items-center">
        <div
          className={classNames(
            'flex items-center justify-center cursor-pointer border border-gray-300 rounded-xl h-12 w-12',
            {
              'bg-blue-400 text-white': type === 'trigger',
              'bg-purple-400 text-white': type === 'callback'
            }
          )}
          onClick={onClickSelect}
        >
          {type === 'trigger' && <i className="fa-solid fa-wand-magic-sparkles" />}
          {type === 'callback' && <i className="fa-solid fa-puzzle-piece" />}
        </div>
        <Select
          className="rounded basis-0 grow border-none hover:bg-gray-100 hover:px-1 font-bold !ring-0 not-hover:bg-none cursor-pointer text-xs py-1 px-1 ml-2"
          size="custom"
          intent="custom"
          value={type}
          onChange={handleChangeType}
        >
          <option value="trigger">Trigger</option>
          <option value="callback">Callback</option>
        </Select>
        <NodeActions onRemove={onRemove} />
      </div>
      <Select2
        className="rounded w-full"
        size="sm"
        placeholder={`Select a ${upperFirst(type)}`}
        value={`${elementId ? `${elementId}-` : ''}${action}`}
        onChange={handleChangeAction}
        options={optionsMemo}
      />
    </div>
  );
};

export default NodeHeader;
