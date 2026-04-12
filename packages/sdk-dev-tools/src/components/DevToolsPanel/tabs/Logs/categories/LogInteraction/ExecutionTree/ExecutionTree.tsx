import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { useCallback, useMemo } from 'react';

import { getDurationMs } from '@plitzi/sdk-shared';

import ExecutionTreeNode from './ExecutionTreeNode';

import type { LogInteraction } from '@plitzi/sdk-shared';

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
      const duration = `${getDurationMs(startTime, endTime)}ms`;
      const level = node.id === nodeId ? 0 : 1;
      tree.push({ id: node.id, action: node.action, title: node.title, status: auxNode.status, level, duration });
      auxNode = get(nodes, node.afterNode) as Nodes[keyof Nodes] | undefined;
    }

    return tree;
  }, [nodeId, nodes]);

  const handleClick = useCallback((id: string) => onSelect?.(id), [onSelect]);

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1.5 px-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
        <i className="fa-solid fa-code-merge" />
        Execution Tree
      </div>
      <div className="flex flex-col">
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
