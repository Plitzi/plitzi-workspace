// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';
import upperFirst from 'lodash/upperFirst';
import Button from '@plitzi/plitzi-ui-components/Button';
import Switch from '@plitzi/plitzi-ui-components/Switch';
import QueryBuilderFormatter from '@plitzi/plitzi-ui/QueryBuilder/helpers/QueryBuilderFormatter';

// Monorepo
import utility from '@plitzi/sdk-data-source/utility';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';

const transformersDefault = [];

/**
 * @param {{
 *   id?: string;
 *   sources?: object;
 *   category?: string;
 *   fromPath?: string;
 *   toPath?: string;
 *   source?: string;
 *   transformers?: object[];
 *   when?: object;
 *   enabled?: boolean;
 *   onEnable?: (category: string, id: string, enabled: boolean) => void;
 *   onUpdate?: (category: string, id: string) => void;
 *   onRemove?: (category: string, id: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BindingSelected = props => {
  const {
    id = '',
    sources = emptyObject,
    category = '',
    fromPath = '',
    toPath = '',
    source = '',
    transformers = transformersDefault,
    when = emptyObject,
    enabled = true,
    onEnable = noop,
    onUpdate = noop,
    onRemove = noop
  } = props;
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const name = useMemo(() => {
    const field = fields.find(f => f.path === fromPath);
    if (!field) {
      return fromPath;
    }

    return field.name ?? fromPath;
  }, [fields, fromPath]);

  const processFields = useCallback(async () => {
    let { fields: fieldsAux } = get(sources, source, {});
    if (fieldsAux && typeof fieldsAux === 'function') {
      setLoading(true);
      fieldsAux = await fieldsAux(true);
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
    if (source && sources && sources[source]) {
      processFields();
    }
  }, [sources, source]);

  const handleClickUpdateBinding = useCallback(() => onUpdate(category, id), [onUpdate]);

  const handleClickRemoveBinding = useCallback(() => onRemove(category, id), [onRemove, category, id]);

  const transformerString = useMemo(() => {
    const str = transformers.reduce((acum, transformer) => {
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
    const str = QueryBuilderFormatter(when);
    if (str) {
      return str;
    }

    return 'None';
  }, [when]);

  const handleChangeEnabled = useCallback(() => onEnable(category, id, !enabled), [enabled, category, id, onEnable]);

  const sourceName = useMemo(() => upperFirst(get(sources, `${source}.name`, source)), [source, sources]);

  return (
    <div className="flex border border-gray-300 rounded-sm [&:not(:first-child)]:mt-2">
      <div className="flex flex-col">
        <Switch
          value={enabled}
          size="sm"
          className="flex items-center justify-center"
          inputClassName="rounded-tl-sm before:rounded-full"
          onChange={handleChangeEnabled}
        />
        <div className="flex flex-col items-center justify-center grow">
          <Button
            className="text-blue-400 hover:text-blue-500 p-1"
            intent="custom"
            size="custom"
            title="Update"
            onClick={handleClickUpdateBinding}
          >
            <i className="fas fa-pencil" />
          </Button>
          <Button
            className="text-red-400 hover:text-red-500 p-1"
            intent="custom"
            size="custom"
            title="Remove"
            onClick={handleClickRemoveBinding}
          >
            <i className="fas fa-times" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col truncate border-l border-gray-300 w-full">
        <div className="flex px-1 py-0.5 text-xs truncate" title={name}>
          <div className="font-bold">From:</div>
          <div className="truncate ml-1">{!loading && `${sourceName} [${name}]`}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={fromPath}>
          <div className="font-bold">Path:</div>
          <div className="truncate ml-1">{`${source}.${fromPath}`}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={upperFirst(toPath)}>
          <div className="font-bold">To:</div>
          <div className="truncate ml-1">{`${upperFirst(category)} ${upperFirst(toPath)}`}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={transformerString}>
          <div className="font-bold">Transformers:</div>
          <div className="truncate ml-1">{transformerString}</div>
        </div>
        <div className="flex px-1 py-0.5 text-xs border-t border-gray-300 truncate" title={whenString}>
          <div className="font-bold">When:</div>
          <div className="truncate ml-1">{whenString}</div>
        </div>
      </div>
    </div>
  );
};

export default BindingSelected;
