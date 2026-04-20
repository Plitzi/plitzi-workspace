/* eslint-disable no-async-promise-executor */

import { get } from '@plitzi/plitzi-ui/helpers';
import Select2 from '@plitzi/plitzi-ui/Select2';
import { useCallback, use, useMemo, useState } from 'react';

import { getPathsFromObeject } from '@plitzi/sdk-shared/helpers/utils';

import WorkflowContext from '../WorkflowContext';

import type { Option, OptionGroup } from '@plitzi/plitzi-ui/Select2';
import type { ElementInteraction, SourceMeta } from '@plitzi/sdk-shared';

export type ParamBindingProps = {
  className?: string;
  nodeId?: string;
  id: keyof ElementInteraction;
  value?: string;
  onChange?: (id: keyof ElementInteraction, value: string | boolean | number) => void;
};

const ParamBinding = ({ nodeId: nodeIdProp = '', id, value = '', onChange }: ParamBindingProps) => {
  const { previewData, getNode, dataSource } = use(WorkflowContext);
  const nodeFullPath = useMemo(() => get(value.match(/(?<token>[a-zA-Z0-9-._]+)/gim), '0', ''), [value]);
  const [node, setNode] = useState<{ value: string; label: string } | undefined>(() => {
    const nodeValue = get(value.match(/(?<token>[a-zA-Z0-9-_]+)/gim), '0', '');
    if (!nodeValue) {
      return undefined;
    }

    return { value: nodeValue, label: get(getNode(nodeValue), 'title', nodeValue) };
  });

  const handleChangeNode = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      if (!option) {
        setNode(undefined);
        onChange?.(id, '');

        return;
      }

      const nodeId = option.value;
      setNode({ value: nodeId, label: get(getNode(nodeId), 'title', nodeId) });
      onChange?.(id, '');
    },
    [onChange, id, getNode]
  );

  const handleChangePath = useCallback(
    (option?: Exclude<Option, OptionGroup>) => {
      if (!option?.value) {
        onChange?.(id, '');
      } else if (option.value && node && !option.value.includes(node.value)) {
        // Custom Node
        onChange?.(id, `{{ ${node.value}.${option.value} }}`);
      } else {
        onChange?.(id, `{{ ${option.value} }}`);
      }
    },
    [node, onChange, id]
  );

  const fieldsDataSource = useMemo(
    () =>
      Object.keys(dataSource).reduce<Exclude<Option, OptionGroup>[]>(
        (acum1, source) => [...acum1, { value: source, label: dataSource[source].name }],
        []
      ),
    [dataSource]
  );

  const nodes = getNode();
  const previewNodes = useMemo<Exclude<Option, OptionGroup>[]>(() => {
    const nodePosition = Object.keys(previewData).findIndex(nodeIdAux => nodeIdAux === nodeIdProp);

    return Object.keys(previewData)
      .filter((nodeId, index) => nodeId !== nodeIdProp && (nodePosition === -1 || index < nodePosition))
      .reduce<Exclude<Option, OptionGroup>[]>(
        (acum, nodeId) => [...acum, { value: nodeId, label: get(nodes, `${nodeId}.title`, nodeId) }],
        []
      );
  }, [previewData, nodeIdProp, nodes]);

  const finalNodes = useMemo<OptionGroup[]>(
    () => [
      { label: 'Data Sources', options: fieldsDataSource },
      { label: 'Nodes', options: previewNodes }
    ],
    [fieldsDataSource, previewNodes]
  );

  const pathOptions = useMemo<Option[] | Promise<Option[]>>(() => {
    if (!node || !node.value) {
      return [];
    }

    let paths: Promise<Exclude<Option, OptionGroup>[]> | Exclude<Option, OptionGroup>[] = [];
    if (!node.value.startsWith('node_') && (dataSource[node.value] as SourceMeta | undefined)) {
      // Its Data Source
      paths = new Promise(async resolve => {
        let { fields } = dataSource[node.value];
        if (typeof fields === 'function') {
          fields = await fields();
        }

        if (!Array.isArray(fields)) {
          fields = [];
        }

        const finalFields = fields.map(field => ({ value: `${node.value}.${field.path}`, label: field.name }));
        if (nodeFullPath && !finalFields.find(field => field.value === nodeFullPath)) {
          finalFields.push({ value: nodeFullPath, label: nodeFullPath.replace(`${node.value}.`, '') });
        }

        resolve(finalFields);
      });
    } else if (previewData[node.value] as Record<string, unknown> | undefined) {
      // Its Node
      paths = getPathsFromObeject(previewData[node.value]).reduce<Exclude<Option, OptionGroup>[]>(
        (acum, path) => [...acum, { value: `${node.value}.${path}`, label: path }],
        []
      );

      if (nodeFullPath && !paths.find(path => path.value === nodeFullPath)) {
        paths.push({ value: nodeFullPath, label: nodeFullPath.replace(`${node.value}.`, '') });
      }
    }

    return paths;
  }, [node, previewData, nodeFullPath, dataSource]);

  return (
    <div className="flex grow basis-0 flex-col gap-2 overflow-hidden">
      <Select2
        size="xs"
        clearable
        placeholder="Select a Source"
        value={node}
        onChange={handleChangeNode}
        options={finalNodes}
      />
      {node && (
        <Select2
          size="xs"
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
