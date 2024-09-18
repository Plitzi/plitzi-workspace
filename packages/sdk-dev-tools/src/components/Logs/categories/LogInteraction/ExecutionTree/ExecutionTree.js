// Packages
import React, { useCallback, useMemo } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import moment from 'moment';
import noop from 'lodash/noop';

// Relatives
import ExecutionTreeNode from './ExecutionTreeNode';

/**
 * @param {{
 *   className?: string;
 *   nodeId: string;
 *   selected?: string;
 *   nodes: object[];
 * }} props
 * @returns {React.ReactElement}
 */
const ExecutionTree = props => {
  const { className, nodeId, nodes, selected, onSelect = noop } = props;

  const treeNodes = useMemo(() => {
    let auxNode = get(nodes, nodeId);
    const tree = [];
    while (auxNode) {
      const { node, startTime, endTime } = auxNode;
      if (!node) {
        break;
      }

      const duration = `${moment.duration(moment(endTime).diff(startTime)).asMilliseconds()}ms`;
      const level = node.id === nodeId ? 0 : 1;
      tree.push({ id: node.id, action: node.action, title: node.title, status: auxNode.status, level, duration });
      auxNode = get(nodes, node.afterNode);
    }

    return tree;
  }, [nodeId, nodes]);

  const handleClick = useCallback(id => onSelect(id), [onSelect]);

  return (
    <div className={classNames('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1">
        <i className="fa-solid fa-code-merge" /> Execution Tree
      </div>
      <div className="flex flex-col gap-1">
        {treeNodes.map((treeNode, i) => (
          <ExecutionTreeNode
            key={i}
            id={treeNode.id}
            action={treeNode.action}
            title={treeNode.title}
            duration={treeNode.duration}
            status={treeNode.status}
            level={treeNode.level}
            isSelected={treeNode.id === selected}
            onClick={handleClick}
          />
        ))}
      </div>
    </div>
  );
};

export default ExecutionTree;
