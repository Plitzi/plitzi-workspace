// Packages
import React, { useCallback, use, useMemo, useState } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';
import get from 'lodash/get';
import Select2 from '@plitzi/plitzi-ui-components/Select2';

// Monorepo
import { getPathsFromObeject } from '@plitzi/sdk-shared/utils';

// Relatives
import WorkflowContext from '../WorkflowContext';

/**
 * @param {{
 *   className?: string;
 *   nodeId?: string;
 *   id?: string;
 *   value?: string;
 *   onChange?: (id: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ParamBinding = props => {
  const { className = '', nodeId: nodeIdProp = '', id = '', value = '', onChange = noop } = props;
  const { previewData, getNode, dataSource } = use(WorkflowContext);
  const nodeFullPath = useMemo(() => get(value.match(/(?<token>[a-zA-Z0-9-._]+)/gim), '0', ''), [value]);
  const [node, setNode] = useState(() => {
    const nodeValue = get(value.match(/(?<token>[a-zA-Z0-9-]+)/gim), '0', '');
    if (!nodeValue) {
      return undefined;
    }

    return { value: nodeValue, label: get(getNode(nodeValue), 'title', nodeValue) };
  });

  const handleChangeNode = useCallback(
    option => {
      if (!option) {
        setNode(undefined);
        onChange(id, '');

        return;
      }

      const nodeId = option.value;
      setNode({ value: nodeId, label: get(getNode(nodeId), 'title', nodeId) });
      onChange(id, '');
    },
    [onChange, id, getNode, previewData]
  );

  const handleChangePath = useCallback(
    option => {
      if (!option?.value) {
        onChange(id, '');
      } else if (option.value && !option.value.includes(node.value)) {
        // Custom Node
        onChange(id, `{{ ${node.value}.${option.value} }}`);
      } else {
        onChange(id, `{{ ${option.value} }}`);
      }
    },
    [id, onChange, node?.value]
  );

  const fieldsDataSource = useMemo(
    () => Object.keys(dataSource).reduce((acum1, source) => [...acum1, { value: source, label: source }], []),
    [dataSource]
  );

  const nodes = getNode();
  const previewNodes = useMemo(() => {
    const nodePosition = Object.keys(previewData).findIndex(nodeIdAux => nodeIdAux === nodeIdProp);

    return Object.keys(previewData)
      .filter((nodeId, index) => nodeId !== nodeIdProp && (nodePosition === -1 || index < nodePosition))
      .reduce((acum, nodeId) => [...acum, { value: nodeId, label: get(nodes, `${nodeId}.title`, nodeId) }], []);
  }, [previewData, id, nodeIdProp, nodes]);

  const finalNodes = useMemo(
    () => [
      { label: 'Data Sources', options: fieldsDataSource },
      { label: 'Nodes', options: previewNodes }
    ],
    [fieldsDataSource, previewNodes]
  );

  const pathOptions = useMemo(() => {
    if (!node || !node.value) {
      return [];
    }

    let paths = [];
    if (!node.value.startsWith('node-') && dataSource[node.value]) {
      // Its Data Source
      paths = new Promise(async resolve => {
        let { fields } = dataSource[node.value];
        if (typeof fields === 'function') {
          fields = await fields(true);
        }

        if (!Array.isArray(fields)) {
          fields = [];
        }

        fields = fields.map(field => ({ value: `${node.value}.${field.path}`, label: field.name }));
        if (nodeFullPath && !fields.find(field => field.value === nodeFullPath)) {
          fields.push({ value: nodeFullPath, label: nodeFullPath.replace(`${node.value}.`, '') });
        }

        resolve(fields);
      });
    } else if (previewData[node.value]) {
      // Its Node
      paths = getPathsFromObeject(previewData[node.value]).reduce(
        (acum, path) => [...acum, { value: `${node.value}.${path}`, label: path }],
        []
      );

      if (nodeFullPath && !paths.find(path => path.value === nodeFullPath)) {
        paths.push({ value: nodeFullPath, label: nodeFullPath.replace(`${node.value}.`, '') });
      }
    }

    return paths;
  }, [node, previewData, value, nodeFullPath, dataSource]);

  return (
    <div className={classNames('', className)}>
      <Select2
        className="rounded"
        size="sm"
        isClearable
        placeholder="Select a Source"
        value={node}
        onChange={handleChangeNode}
        options={finalNodes}
      />
      {node && (
        <Select2
          className="rounded mt-2"
          size="sm"
          placeholder="Select a Binding"
          value={nodeFullPath}
          onChange={handleChangePath}
          options={pathOptions}
          allowCreateOptions
        />
      )}
    </div>
  );
};

export default ParamBinding;
