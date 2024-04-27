// Packages
import React, { useCallback, useContext, useEffect, useMemo, memo } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Monorepo
import { emptyObject, getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Relatives
import NodeHeader from './NodeHeader';
import NodeBody from './NodeBody';
import WorkflowContext from '../WorkflowContext';
import NodeFooter from './NodeFooter';
import NodeWhen from './NodeWhen';
import NodePreview from './NodePreview';

/**
 * @param {{
 *   className?: string;
 *   id?: string;
 *   title?: string;
 *   type?: 'trigger' | 'callback' | 'utility' | 'globalCallback';
 *   canDelete?: boolean;
 *   action?: string;
 *   elementId?: string;
 *   enabled?: boolean;
 *   beforeNode?: string;
 *   afterNode?: string;
 *   triggerId?: string;
 *   params?: object;
 *   when?: object;
 *   preview?: object;
 *   isOpened?: boolean;
 *   onOpened?: (id: string, isOpened: boolean) => void;
 *   onRemove?: (id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const WorkflowNode = props => {
  const {
    className = '',
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
    params = emptyObject,
    when = emptyObject,
    preview = emptyObject,
    isOpened = false,
    onOpened = noop,
    onRemove = noop
  } = props;
  const { previewData, getNode, updateNode, setPreviewNode, nodeDefinitions, dataSourceContent } =
    useContext(WorkflowContext);

  const handleClickOpen = useCallback(() => onOpened(id, !isOpened), [id, isOpened, onOpened]);

  const handleClickRemove = useCallback(() => onRemove(id), [id]);

  const handleChange = useCallback(node => updateNode({ id, ...node }), [id, updateNode]);

  const nodeDefinition = useMemo(
    () =>
      nodeDefinitions.find(n => n.type === type && (!n.elementId || n.elementId === elementId) && n.action === action),
    [nodeDefinitions, type, elementId, action]
  );

  const defaultPreview = useMemo(() => {
    if (!nodeDefinition) {
      return undefined;
    }

    const { preview: nodePreview } = nodeDefinition;
    if (typeof nodePreview === 'function') {
      return nodePreview(params);
    }

    if (typeof nodePreview === 'object') {
      return nodePreview;
    }

    return undefined;
  }, [nodeDefinition, params?.template]);

  const nodeParams = useMemo(() => {
    if (typeof nodeDefinition?.params === 'function') {
      return nodeDefinition?.params(params);
    }

    return nodeDefinition?.params;
  }, [nodeDefinition?.params, params]);

  useEffect(() => {
    if (typeof preview === 'object' && Object.keys(preview).length > 0) {
      setPreviewNode(id, { ...preview });
    } else if (typeof defaultPreview === 'object') {
      setPreviewNode(id, { ...defaultPreview });
    }

    return () => {
      setPreviewNode(id, undefined);
    };
  }, [setPreviewNode, defaultPreview, preview, id]);

  const fields = useMemo(() => {
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
              label,
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
  }, [dataSourceContent, previewData, getNode, previewData]);

  return (
    <div
      className={classNames(
        'w-full border-2 rounded-xl',
        { 'border-gray-300': !isOpened, 'border-blue-500': isOpened },
        className
      )}
    >
      <NodeHeader
        className={classNames('mt-2', { 'border-b-2 border-gray-300 border-dotted': isOpened })}
        id={id}
        title={title}
        type={type}
        canDelete={canDelete}
        action={action}
        elementId={elementId}
        nodeDefinitions={nodeDefinitions}
        nodeDefinition={nodeDefinition}
        isOpened={isOpened}
        isFirstNode={!beforeNode || beforeNode === triggerId}
        enabled={enabled}
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
      {isOpened && (
        <NodeFooter
          id={id}
          canUp={!!beforeNode && beforeNode !== triggerId}
          canDown={!!afterNode}
          onClickOpen={handleClickOpen}
        />
      )}
    </div>
  );
};

export default memo(WorkflowNode);
