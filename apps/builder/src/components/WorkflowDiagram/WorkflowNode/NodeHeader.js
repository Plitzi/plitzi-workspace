// Packages
import React, { useCallback, use, useMemo } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import Select from '@plitzi/plitzi-ui/Select';
import Select2 from '@plitzi/plitzi-ui/Select2';
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
      // @todo: this is broken, check plitzi-ui implementation
      e.stopPropagation();
      onChange({ type: e.target.value, action: '', elementId: '', params: {} });
    },
    [onChange]
  );

  const handleChangeAction = useCallback(
    option => {
      // @todo: this is broken, check plitzi-ui implementation
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
          value: `${nodeDefinition.elementId ? `${nodeDefinition.elementId}_` : ''}${nodeDefinition.action}`,
          label: nodeDefinition.title
        })),
    [nodeDefinitions]
  );

  return (
    <div className={classNames('flex w-full flex-col p-2', className)}>
      <div className="flex items-center">
        <div
          className={classNames(
            'flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border border-gray-300',
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
          className="ml-2 grow basis-0 cursor-pointer rounded-sm border-none px-1 py-1 text-xs font-bold !ring-0 hover:bg-gray-100 hover:px-1 [&:not(:hover)]:bg-none"
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
        className="w-full rounded-sm"
        size="sm"
        placeholder={`Select a ${upperFirst(type)}`}
        value={`${elementId ? `${elementId}_` : ''}${action}`}
        onChange={handleChangeAction}
        options={optionsMemo}
      />
    </div>
  );
};

export default NodeHeader;
