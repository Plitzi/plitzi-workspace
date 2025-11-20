'use client';
import Badge from '@plitzi/plitzi-ui/Badge';
import Card from '@plitzi/plitzi-ui/Card';
import Icon from '@plitzi/plitzi-ui/Icon';
import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';

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

type NodeDirectoryPage = Node<{ label: string; accessLevel: string; path: string; type: string; description: string }>;

export const CustomNode = memo(({ data }: NodeProps<NodeDirectoryPage>) => {
  const config = accessLevelConfig[data.accessLevel as keyof typeof accessLevelConfig];

  return (
    <>
      <Handle type="target" position={Position.Top} className="h-3 w-3 bg-slate-400!" />

      <Card className="h-[150px] w-[200px] p-2 shadow-md transition-shadow hover:shadow-lg">
        <Card.Header>
          <div className="flex items-start gap-2">
            <Icon
              icon={data.type === 'folder' ? 'fa-regular fa-folder' : 'fa-regular fa-file'}
              className="mt-0.5 h-5 w-5 shrink-0 text-slate-600"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-foreground truncate text-sm font-semibold">{data.label}</h3>
              {data.path && <p className="text-muted-foreground truncate text-xs">{data.path}</p>}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Badge solid={false} intent="custom" size="xs" icon={config.icon} className={config.color}>
                {config.label}
              </Badge>
            </div>

            {data.description && <p className="text-muted-foreground line-clamp-3 text-xs">{data.description}</p>}
          </div>
        </Card.Body>
      </Card>

      <Handle type="source" position={Position.Bottom} className="h-3 w-3 bg-slate-400!" />
    </>
  );
});

CustomNode.displayName = 'CustomNode';
