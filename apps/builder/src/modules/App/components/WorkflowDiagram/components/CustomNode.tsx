import Badge from '@plitzi/plitzi-ui/Badge';
import Card from '@plitzi/plitzi-ui/Card';
import Icon from '@plitzi/plitzi-ui/Icon';
import { Handle, Position } from '@xyflow/react';
import classNames from 'classnames';
import { memo } from 'react';

import type { WorkflowNode } from '../WorkflowDiagram';
import type { Node, NodeProps } from '@xyflow/react';

const accessLevelConfig = {
  none: {
    label: 'None',
    color: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: 'fa-solid fa-lock'
  },
  public: {
    label: 'Public',
    color: 'bg-secondary-100 text-secondary-700 border-secondary-300',
    icon: 'fa-solid fa-globe'
  },
  authenticated: {
    label: 'Auth',
    color: 'bg-primary-100 text-primary-700 border-primary-300',
    icon: 'fa-solid fa-shield-halved'
  }
};

export const CustomNode = memo(({ data, selected }: NodeProps<Node<WorkflowNode>>) => {
  const config = accessLevelConfig[data.accessLevel as keyof typeof accessLevelConfig];

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="h-4! w-4! border-4! border-white! bg-blue-500! shadow-lg transition-all duration-200 hover:scale-110 hover:bg-blue-600!"
      />

      <Card
        className={classNames('h-[150px] w-[200px] p-2 shadow-md transition-shadow hover:shadow-lg', {
          'ring-2 ring-blue-500 ring-offset-2': selected
        })}
      >
        <Card.Header>
          <div className="flex w-full items-start gap-1">
            <Icon
              icon={data.type === 'folder' ? 'fa-regular fa-folder' : 'fa-regular fa-file'}
              className={classNames('mt-0.5 h-5 shrink-0 text-slate-600', {
                'text-yellow-600': data.type === 'folder',
                'text-slate-600': data.type !== 'folder'
              })}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-sm font-semibold">{data.title}</h3>
              {data.path && (
                <p className="text-muted-foreground truncate rounded-sm text-xs text-gray-500">{data.path}</p>
              )}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <hr className="my-1 border-gray-300" />
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2">
              <Badge solid={false} intent="custom" size="xs" icon={config.icon} className={config.color}>
                {config.label}
              </Badge>
            </div>

            {data.description && <p className="text-muted-foreground line-clamp-3 text-xs">{data.description}</p>}
          </div>
        </Card.Body>
      </Card>

      <Handle
        type="source"
        position={Position.Bottom}
        className="h-4! w-4! border-4! border-white! bg-blue-500! shadow-lg transition-all duration-200 hover:scale-110 hover:bg-blue-600!"
      />
    </>
  );
});

CustomNode.displayName = 'CustomNode';
