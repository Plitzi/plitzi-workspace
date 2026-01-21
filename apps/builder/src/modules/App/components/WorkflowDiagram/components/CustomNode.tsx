/* eslint-disable quotes */
import Badge from '@plitzi/plitzi-ui/Badge';
import Card from '@plitzi/plitzi-ui/Card';
import Icon from '@plitzi/plitzi-ui/Icon';
import Modal, { useModal } from '@plitzi/plitzi-ui/Modal';
import { useToast } from '@plitzi/plitzi-ui/Toast';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import clsx from 'clsx';
import { memo, useCallback } from 'react';

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

const CustomNode = memo(({ id, data, selected = false }: NodeProps<Node<WorkflowNode>>) => {
  const { getEdges, setNodes } = useReactFlow();
  const { addToast } = useToast();
  const { showDialog } = useModal();
  const config = accessLevelConfig[data.accessLevel as keyof typeof accessLevelConfig];

  const handleClickRemove = useCallback(async () => {
    const edges = getEdges();
    if (edges.find(edge => edge.source === id)) {
      addToast("You can't remove this folder with elements or folders", {
        appeareance: 'warning',
        autoDismiss: true,
        placement: 'top-right'
      });

      return;
    }

    const response = await showDialog(
      <Modal.Header>
        <h4>Remove {data.type === 'folder' ? 'Folder' : 'Page'}</h4>
      </Modal.Header>,
      <Modal.Body>
        <h4>Do you want to remove this item ?</h4>
      </Modal.Body>,
      undefined,
      { size: 'sm' },
      id
    );

    if (response) {
      setNodes(node => node.filter(e => e.id !== id));
    }
  }, [addToast, data.type, getEdges, id, setNodes, showDialog]);

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="bg-primary-500! hover:bg-primary-600! h-5! w-5! border-4! border-white! shadow-lg transition-all duration-200 hover:scale-110"
      />
      <Card
        className={clsx('h-37.5 w-50 p-2 shadow-md transition-shadow hover:shadow-lg', {
          'ring-2 ring-blue-500 ring-offset-2': selected
        })}
      >
        <Card.Header>
          <div className="flex w-full items-start">
            <div className="flex w-full items-center justify-between gap-1">
              <Icon
                icon={data.type === 'folder' ? 'fa-regular fa-folder' : 'fa-regular fa-file'}
                className={clsx('mt-0.5 h-5 shrink-0 text-slate-600', {
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
            {selected && (
              <div className="flex items-center justify-center rounded p-1 hover:bg-red-100" title="Remove">
                <Icon
                  icon="fas fa-trash-alt"
                  intent="danger"
                  size="sm"
                  onClick={handleClickRemove}
                  className="cursor-pointer"
                />
              </div>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          <hr className="my-1 border-gray-300" />
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2">
              <Badge solid={false} intent="custom" size="xs" icon={config.icon} className={config.color}>
                {config.label}
              </Badge>
              {data.type === 'page' && data.isDefault && (
                <Badge
                  solid={false}
                  intent="custom"
                  size="xs"
                  icon="fas fa-home"
                  className="bg-primary-100 text-primary-700 border-primary-300"
                >
                  Home Page
                </Badge>
              )}
            </div>

            {data.description && <p className="text-muted-foreground line-clamp-3 text-xs">{data.description}</p>}
          </div>
        </Card.Body>
      </Card>
      {data.type === 'folder' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="bg-primary-500! hover:bg-primary-600! h-5! w-5! border-4! border-white! shadow-lg transition-all duration-200 hover:scale-110"
        />
      )}
    </>
  );
});

export default CustomNode;
