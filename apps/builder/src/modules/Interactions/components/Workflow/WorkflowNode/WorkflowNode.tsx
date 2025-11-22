import clsx from 'clsx';
import { useCallback, use, useEffect, useMemo, memo } from 'react';

import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';

import NodeBody from './NodeBody';
import NodeHeader from './NodeHeader';
import WorkflowContext from '../WorkflowContext';
import NodeFooter from './NodeFooter';
import NodePreview from './NodePreview';
import NodeWhen from './NodeWhen';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { ElementInteraction, InteractionCallbackParam, InteractionCallbackParamValues } from '@plitzi/sdk-shared';

export type WorkflowNodeProps = {
  id?: string;
  title?: string;
  type?: 'trigger' | 'callback' | 'utility' | 'globalCallback';
  canDelete?: boolean;
  action?: string;
  elementId?: string;
  enabled?: boolean;
  beforeNode?: string;
  afterNode?: string;
  triggerId?: string;
  params?: InteractionCallbackParamValues;
  when?: RuleGroup;
  preview?: Record<string, unknown>;
  isOpened?: boolean;
  onOpened?: (id: string, isOpened: boolean) => void;
  onRemove?: (id: string) => void;
};

const WorkflowNode = ({
  id = '',
  title = 'Title',
  type = 'callback',
  canDelete = false,
  action = '',
  elementId = '',
  enabled = false,
  beforeNode = '',
  afterNode = '',
  triggerId = '',
  params,
  when,
  preview,
  isOpened = false,
  onOpened,
  onRemove
}: WorkflowNodeProps) => {
  const { previewData, getNode, updateNode, setPreviewNode, nodeDefinitions, dataSourceContent } = use(WorkflowContext);

  const handleClickOpen = useCallback(() => onOpened?.(id, !isOpened), [id, isOpened, onOpened]);

  const handleClickRemove = useCallback(() => onRemove?.(id), [id, onRemove]);

  const handleChange = useCallback(
    (node: Partial<ElementInteraction>) => updateNode({ ...node, id } as ElementInteraction),
    [id, updateNode]
  );

  const nodeDefinition = useMemo(
    () =>
      nodeDefinitions?.find(n => n.type === type && (!n.elementId || n.elementId === elementId) && n.action === action),
    [nodeDefinitions, type, elementId, action]
  );

  const defaultPreview = useMemo(() => {
    if (!nodeDefinition) {
      return undefined;
    }

    const { preview: nodePreview } = nodeDefinition;
    if (typeof nodePreview === 'function') {
      return nodePreview(params ?? {});
    }

    return nodePreview;
  }, [nodeDefinition, params]);

  const nodeParams = useMemo<Record<string, InteractionCallbackParam>>(() => {
    if (typeof nodeDefinition?.params === 'function') {
      return nodeDefinition.params(params ?? {});
    }

    return nodeDefinition?.params ?? {};
  }, [nodeDefinition, params]);

  useEffect(() => {
    if (typeof preview === 'object' && Object.keys(preview).length > 0) {
      setPreviewNode(id, { ...preview });
    } else if (defaultPreview && typeof defaultPreview === 'object') {
      setPreviewNode(id, { ...defaultPreview });
    }

    return () => {
      setPreviewNode(id, undefined);
    };
  }, [setPreviewNode, defaultPreview, preview, id]);

  const fields = useMemo<Record<string, { name: string; label: string; placeholder: string; group: string }>>(() => {
    const dataSource = Object.keys(dataSourceContent).reduce(
      (acum1, source) => ({
        ...acum1,
        ...dataSourceContent[source].reduce((acum2, field) => {
          const { path } = field;
          const label = path.split('.').pop();

          return {
            ...acum2,
            [`${source}_${path.replaceAll('.', '_')}`]: {
              name: `${source}.${path}`,
              label: `${source}.${path}`,
              placeholder: `Enter ${label}`,
              group: `Data Sources - ${source}`
            }
          };
        }, {})
      }),
      {}
    );

    const nodes = getNode();
    const nodesParsed = Object.values(nodes).reduce((acum1, node) => {
      const { id: nodeId, title, params } = node;

      return {
        ...acum1,
        ...getPathsFromObeject(params).reduce(
          (acum2, path) => ({
            ...acum2,
            [`${nodeId}_${path}`]: {
              name: `${nodeId}.${path}`,
              label: path,
              placeholder: `Enter ${path}`,
              group: `${title} - Param`
            }
          }),
          {}
        ),
        ...getPathsFromObeject(previewData[nodeId]).reduce(
          (acum2, path) => ({
            ...acum2,
            [`${nodeId}_${path}`]: {
              name: `${nodeId}.${path}`,
              label: path,
              placeholder: `Enter ${path}`,
              group: `${title} - Response`
            }
          }),
          {}
        )
      };
    }, {});

    return { ...dataSource, ...nodesParsed };
  }, [dataSourceContent, previewData, getNode]);

  return (
    <div
      className={clsx('w-full rounded-xl border-2 bg-white', {
        'border-gray-300': !isOpened,
        'border-blue-500': isOpened
      })}
    >
      <NodeHeader
        className={clsx({ 'border-b-2 border-dotted border-gray-300': isOpened })}
        id={id}
        title={title}
        type={type}
        canDelete={canDelete}
        action={action}
        elementId={elementId}
        nodeDefinitions={nodeDefinitions}
        nodeDefinition={nodeDefinition}
        isOpened={isOpened}
        enabled={enabled}
        canUp={!!beforeNode && beforeNode !== triggerId}
        canDown={!!afterNode}
        onChange={handleChange}
        onClickOpen={handleClickOpen}
        onClickRemove={handleClickRemove}
      />
      {isOpened && (
        <NodeBody id={id} paramDefinitions={nodeParams} params={params} fields={fields} onChange={handleChange} />
      )}
      {isOpened && nodeDefinition && <NodeWhen when={when} fields={fields} onChange={handleChange} />}
      {isOpened && nodeDefinition && (
        <NodePreview preview={preview} defaultPreview={defaultPreview} onChange={handleChange} />
      )}
      {isOpened && <NodeFooter onClickOpen={handleClickOpen} />}
    </div>
  );
};

export default memo(WorkflowNode);
