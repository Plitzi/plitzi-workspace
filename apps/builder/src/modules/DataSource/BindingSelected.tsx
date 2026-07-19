import Button from '@plitzi/plitzi-ui/Button';
import { get } from '@plitzi/plitzi-ui/helpers';
import Switch from '@plitzi/plitzi-ui/Switch';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useState } from 'react';

import getBindingWarnings, { WARNING_ICON, worstLevel } from './helpers/getBindingWarnings';
import transformerString from './helpers/transformerString';
import whenString from './helpers/whenString';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { BindingTransformer, SourceField, SourceMeta, BindingCategory } from '@plitzi/sdk-shared';

export type BindingSelected = {
  id?: string;
  sources?: Record<string, SourceMeta>;
  category?: string;
  to?: string;
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
  to = '',
  source = '',
  transformers,
  when,
  enabled = true,
  onEnable,
  onUpdate,
  onRemove
}: BindingSelected) => {
  const [fields, setFields] = useState<SourceField[]>([]);
  const dotIndex = source.indexOf('.');
  const sourceName = dotIndex > -1 ? source.substring(0, dotIndex) : source;
  const fieldPath = dotIndex > -1 ? source.substring(dotIndex + 1) : '';
  const [loading, setLoading] = useState(typeof get(sources, sourceName, {} as SourceMeta).fields === 'function');
  const name = useMemo(() => {
    if (!fieldPath) {
      return 'None';
    }

    const field = fields.find(f => f.path === fieldPath);
    if (!field) {
      return fieldPath;
    }

    return field.name ? field.name : fieldPath;
  }, [fields, fieldPath]);

  const processFields = useCallback(async () => {
    let { fields: fieldsAux } = get(sources, sourceName, {} as SourceMeta);
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
  }, [sources, sourceName]);

  useEffect(() => {
    if (sourceName && sources?.[sourceName]) {
      void processFields();
    } else {
      setLoading(false);
    }
  }, [sources, sourceName, processFields]);

  const handleClickUpdateBinding = useCallback(
    () => onUpdate?.(category as BindingCategory, id),
    [category, id, onUpdate]
  );

  const handleClickRemoveBinding = useCallback(
    () => onRemove?.(category as BindingCategory, id),
    [onRemove, category, id]
  );

  const transformerName = useMemo(() => transformerString(transformers), [transformers]);
  const whenStr = useMemo(() => whenString(when), [when]);
  const sourceDisplayName = useMemo(() => get(sources, `${sourceName}.name`, sourceName), [sourceName, sources]);
  const warnings = useMemo(
    () => getBindingWarnings({ source, transformers, sources }),
    [source, transformers, sources]
  );
  const warningLevel = worstLevel(warnings);
  const warningTitle = warnings.map(w => w.message).join('\n\n');

  const handleChangeEnabled = useCallback(
    () => onEnable?.(category as BindingCategory, id, !enabled),
    [enabled, category, id, onEnable]
  );

  return (
    <div
      className={clsx('flex rounded-sm border', {
        'border-gray-300 dark:border-zinc-600': !warningLevel,
        'border-orange-400 dark:border-orange-500': warningLevel === 'warning',
        'border-red-400 dark:border-red-500': warningLevel === 'danger'
      })}
    >
      <div className="flex flex-col items-center gap-2 p-1">
        {warningLevel && (
          <i className={clsx(WARNING_ICON[warningLevel])} title={warningTitle} aria-label={warningTitle} />
        )}
        <Switch checked={enabled} size="xs" onChange={handleChangeEnabled} />
        <div className="flex grow flex-col items-center justify-end gap-1">
          <Button size="xs" title="Update" onClick={handleClickUpdateBinding}>
            <Button.Icon icon="fas fa-pencil" />
          </Button>
          <Button intent="danger" size="xs" title="Remove" onClick={handleClickRemoveBinding}>
            <Button.Icon icon="fas fa-times" />
          </Button>
        </div>
      </div>
      <div className="flex w-full flex-col truncate border-l border-gray-300 dark:border-zinc-600">
        <div className="flex truncate px-1 py-0.5 text-xs" title={name}>
          <div className="font-bold">From:</div>
          <div className="ml-1 truncate capitalize">
            {!loading ? (fieldPath ? `${sourceDisplayName} [${name}]` : 'None') : 'Loading...'}
          </div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600" title={source}>
          <div className="font-bold">Path:</div>
          <div className="ml-1 truncate">{source || ''}</div>
        </div>
        <div className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600" title={to}>
          <div className="font-bold">To:</div>
          <div className="ml-1 truncate capitalize">{`${category} ${to}`}</div>
        </div>
        <div
          className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600"
          title={transformerName}
        >
          <div className="font-bold">Transformers:</div>
          <div className="ml-1 truncate">{transformerName}</div>
        </div>
        <div
          className="flex truncate border-t border-gray-300 px-1 py-0.5 text-xs dark:border-zinc-600"
          title={whenStr}
        >
          <div className="font-bold">When:</div>
          <div className="ml-1 truncate">{whenStr}</div>
        </div>
      </div>
    </div>
  );
};

export default BindingSelected;
