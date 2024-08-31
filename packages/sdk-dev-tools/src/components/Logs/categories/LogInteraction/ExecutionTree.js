// Packages
import React, { useMemo } from 'react';
import get from 'lodash/get';
import classNames from 'classnames';
import moment from 'moment';

/**
 * @param {{
 *   className?: string;
 *   nodeId: string;
 *   nodes: object[];
 * }} props
 * @returns {React.ReactElement}
 */
const ExecutionTree = props => {
  const { className, nodeId, nodes } = props;

  const treeNodes = useMemo(() => {
    let auxNode = get(nodes, nodeId);
    const tree = [];
    while (auxNode) {
      const { node, startTime, endTime } = auxNode;
      const duration = `${moment.duration(moment(endTime).diff(startTime)).asSeconds()}s`;
      const level = auxNode?.node.id === nodeId ? 0 : 1;
      tree.push({ title: get(node, 'title'), status: get(auxNode, 'status'), level, duration });

      auxNode = get(nodes, node.afterNode);
    }

    return tree;
  }, [nodeId, nodes]);

  return (
    <div className={classNames('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1">
        <i className="fa-solid fa-code-merge" /> Execution Tree
      </div>
      <div className="flex flex-col gap-1">
        {treeNodes.map((treeNode, i) => (
          <div
            key={i}
            className={classNames('flex gap-1 items-center hover:bg-gray-200 cursor-pointer', {
              'pl-4': treeNode.level === 1
            })}
          >
            <div
              className={classNames('w-2.5 h-2.5 rounded-full', {
                'bg-green-500': treeNode.status === 'success',
                'bg-gray-500': treeNode.status === 'skipped' || treeNode.status === 'disabled'
              })}
              title={treeNode.status}
            />
            {treeNode.title} ({treeNode.duration})
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutionTree;
