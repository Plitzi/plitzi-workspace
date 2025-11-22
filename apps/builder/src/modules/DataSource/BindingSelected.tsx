import Button from '@plitzi/plitzi-ui/Button';
import { QueryBuilderFormatter } from '@plitzi/plitzi-ui/QueryBuilder';
import Switch from '@plitzi/plitzi-ui/Switch';
import get from 'lodash-es/get';
import upperFirst from 'lodash-es/upperFirst';
import { useCallback, useEffect, useMemo, useState } from 'react';

import utility from '@plitzi/sdk-data-source/utility/index';

import type { BindingCategory } from './DataSourceBinding';
import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { BindingTransformer, SourceField, SourceMeta } from '@plitzi/sdk-shared';

export type BindingSelected = {
  id?: string;
  sources?: Record<string, SourceMeta>;
  category?: string;
  fromPath?: string;
  toPath?: string;
  source?: string;
  transformers?: BindingTransformer[];
  when?: RuleGroup;
  enabled?: boolean;
  onEnable?: (category: BindingCategory, id: string, enabled: boolean) => void;
  onUpdate?: (category: BindingCategory, id: string) => void;
  onRemove?: (category: BindingCategory, id: string) => void;
};

const BindingSelected = ({
  id = '',
  sources,
  category = '',
  fromPath = '',
  toPath = '',
  source = '',
  transformers,
  when,
  enabled = true,
  onEnable,
  onUpdate,
  onRemove
}: BindingSelected) => {
  const [fields, setFields] = useState<SourceField[]>([]);
  const [loading, setLoading] = useState(false);
  const name = useMemo(() => {
    const field = fields.find(f => f.path === fromPath);
    if (!field) {
      return fromPath;
    }

    return field.name ? field.name : fromPath;
  }, [fields, fromPath]);

  const processFields = useCallback(async () => {
    let { fields: fieldsAux } = get(sources, source, {} as SourceMeta);
    if (fieldsAux && typeof fieldsAux === 'function') {
      setLoading(true);
      fieldsAux = await fieldsAux();
      setLoading(false);
    } else {
      setLoading(false);
    }

    if (Array.isArray(fieldsAux)) {
      setFields(fieldsAux);
    } else {
      setFields([]);
    }
  }, [sources, source]);

  useEffect(() => {
    if (source && sources?.[source]) {
      void processFields();
    }
  }, [sources, source, processFields]);

  const handleClickUpdateBinding = useCallback(
    () => onUpdate?.(category as BindingCategory, id),
    [category, id, onUpdate]
  );

  const handleClickRemoveBinding = useCallback(
    () => onRemove?.(category as BindingCategory, id),
    [onRemove, category, id]
  );

  const transformerString = useMemo(() => {
    const str = transformers?.reduce((acum, transformer) => {
      switch (transformer.action) {
        case 'staticValue':
          return `${acum}${acum === '' ? '' : ', '}${get(
            utility,
            `${transformer.action}.title`,
            transformer.action
          )} = ${transformer.params.value}`;

        default:
          return `${acum}${acum === '' ? '' : ', '}${get(utility, `${transformer.action}.title`, transformer.action)}`;
      }
    }, '');
    if (str) {
      return str;
    }

    return 'None';
  }, [transformers]);

  const whenString = useMemo(() => {
    if (!when) {
      return 'None';
    }

    const str = QueryBuilderFormatter(when);
    if (str) {
      return str;
    }

    return 'None';
  }, [when]);

  const handleChangeEnabled = useCallback(
    () => onEnable?.(category as BindingCategory, id, !enabled),
    [enabled, category, id, onEnable]
  );

  const sourceName = useMemo(() => upperFirst(get(sources, `${source}.name`, source) as string), [source, sources]);

  return (
    <div className="flex rounded-sm border border-gray-300">
      <div className="flex flex-col items-center gap-2 p-1">
        <Switch checked={enabled} size="xs" onChange={handleChangeEnabled} />
        <div className="flex grow flex-col items-center justify-center gap-1">
          <Button size="xs" title="Update" onClick={handleClickUpdateBinding}>
            <Button.Icon icon="fas fa-pencil" />
          </Button>
          <Button intent="danger" size="xs" title="Remove" onClick={handleClickRemoveBinding}>
            <Button.Icon icon="fas fa-times" />
          </Button>
        </div>
      </div>
      <div className="flex w-full flex-col truncate border-l border-gray-300">
        <div className="flex truncate px-1 py-0.5 text-xs" title={name}>
          <div className="font-bold">From:</div>
          <div className="ml-1 truncate">{!loading && `${sourceName} [${name}]`}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={fromPath}>
          <div className="font-bold">Path:</div>
          <div className="ml-1 truncate">{`${source}.${fromPath}`}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={upperFirst(toPath)}>
          <div className="font-bold">To:</div>
          <div className="ml-1 truncate">{`${upperFirst(category)} ${upperFirst(toPath)}`}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={transformerString}>
          <div className="font-bold">Transformers:</div>
          <div className="ml-1 truncate">{transformerString}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs" title={whenString}>
          <div className="font-bold">When:</div>
          <div className="ml-1 truncate">{whenString}</div>
        </div>
      </div>
    </div>
  );
};

export default BindingSelected;
