// Packages
import classNames from 'classnames';
import get from 'lodash/get';
import moment from 'moment';
import { useCallback, useMemo } from 'react';

// Relatives
import ExecutionTreeNode from './ExecutionTreeNode';

// Types
import type { LogInteraction } from '../../../../../../../DevToolsContext';

type Nodes = LogInteraction['params']['nodes'];

export type ExecutionTreeProps = {
  className?: string;
  nodeId: string;
  selected?: string;
  nodes: Nodes;
  onSelect?: (id?: string) => void;
};

const ExecutionTree = ({ className, nodeId, nodes, selected, onSelect }: ExecutionTreeProps) => {
  const treeNodes = useMemo(() => {
    let auxNode = get(nodes, nodeId) as Nodes[keyof Nodes] | undefined;
    const tree = [];
    while (auxNode) {
      const { node, startTime, endTime } = auxNode;
      const duration = `${moment.duration(moment(endTime).diff(startTime)).asMilliseconds()}ms`;
      const level = node.id === nodeId ? 0 : 1;
      tree.push({ id: node.id, action: node.action, title: node.title, status: auxNode.status, level, duration });
      auxNode = get(nodes, node.afterNode) as Nodes[keyof Nodes] | undefined;
    }

    return tree;
  }, [nodeId, nodes]);

  const handleClick = useCallback((id: string) => onSelect?.(id), [onSelect]);

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
