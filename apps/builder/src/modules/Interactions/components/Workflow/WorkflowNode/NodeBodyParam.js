// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import upperFirst from 'lodash/upperFirst';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import Button from '@plitzi/plitzi-ui-components/Button';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Switch from '@plitzi/plitzi-ui-components/Switch';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

// Relatives
import { isValidToken } from '../../../../../helpers/twigWrapper';
import ParamBinding from './ParamBinding';
import { emptyObject } from '../../../../../helpers/utils';

const optionsDefault = [];

const NodeBodyParam = props => {
  const {
    className = '',
    nodeId = '',
    id = '',
    label = '',
    value = '',
    type = 'text',
    options = optionsDefault,
    canBind = true,
    params = emptyObject,
    fields = emptyObject,
    onChange = noop
  } = props;
  const [isBinding, setIsBinding] = useState(() => canBind && typeof value === 'string' && isValidToken(value));
  const [internalOptions, setInternalOptions] = useState([]);

  const handleChange = useCallback(
    e => {
      if (type === 'text' || type === 'textarea') {
        onChange(id, e.target.value);
      } else if (type === 'select' && e) {
        onChange(id, e.value);
      } else if (type === 'select') {
        onChange(id, '');
      } else if (type === 'boolean') {
        onChange(id, e.target.checked);
      } else if (type === 'codemirror-json' || type === 'codemirror-text') {
        onChange(id, e);
      }
    },
    [id, onChange]
  );

  const handleClickBind = useCallback(() => {
    onChange(id, '');
    setIsBinding(state => !state);
  }, [onChange]);

  const processOptions = useCallback(async (options, params) => {
    const optionsAux = [];
    if (typeof options === 'function') {
      const opts = await options(params);
      if (Array.isArray(opts)) {
        optionsAux.push(...opts);
      }
    } else if (Array.isArray(options)) {
      optionsAux.push(...options);
    }

    setInternalOptions(optionsAux);
  }, []);

  useEffect(() => {
    processOptions(options, params);
  }, [options, params]);

  const finalLabel = useMemo(() => (!label ? upperFirst(id) : label), [label, id]);
  const fieldsKeys = useMemo(() => Object.values(fields).reduce((acum, field) => [...acum, field.name], []), [fields]);

  return (
    <div className={classNames('flex flex-col w-full not-first:mt-2', className)}>
      <label htmlFor={id} className="text-sm">
        {finalLabel}
      </label>
      <div className="flex">
        {!isBinding && type === 'text' && (
          <Input className="w-full" size="sm" inputClassName="rounded" id={id} value={value} onChange={handleChange} />
        )}
        {!isBinding && type === 'select' && (
          <Select2
            className="rounded w-full basis-0 min-w-0 grow"
            size="sm"
            placeholder={`Select a ${finalLabel}`}
            value={value}
            onChange={handleChange}
            options={internalOptions}
            allowCreateOptions
          />
        )}
        {!isBinding && type === 'boolean' && (
          <Switch className="rounded w-full" size="sm" value={value} onChange={handleChange} />
        )}
        {!isBinding && type === 'textarea' && (
          <TextArea className="rounded w-full" size="sm" value={value} onChange={handleChange} />
        )}
        {!isBinding && type === 'codemirror-json' && (
          <CodeMirror
            className="min-h-[80px]"
            value={value}
            theme="light"
            mode="json"
            autoComplete={fieldsKeys}
            lineWrapping
            onChange={handleChange}
          />
        )}
        {!isBinding && type === 'codemirror-text' && (
          <CodeMirror
            className="min-h-[80px]"
            value={value}
            theme="light"
            mode="text"
            autoComplete={fieldsKeys}
            lineWrapping
            onChange={handleChange}
          />
        )}
        {isBinding && <ParamBinding className="w-full" nodeId={nodeId} id={id} onChange={onChange} value={value} />}
        {canBind && (
          <Button size="sm" className="ml-2 rounded w-8" onClick={handleClickBind}>
            {!isBinding && <i className="fa-solid fa-plug" />}
            {isBinding && <i className="fa-solid fa-plug-circle-xmark" />}
          </Button>
        )}
      </div>
    </div>
  );
};

NodeBodyParam.propTypes = {
  className: PropTypes.string,
  nodeId: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool, PropTypes.number]),
  type: PropTypes.oneOf(['text', 'select', 'textarea', 'boolean', 'codemirror-text', 'codemirror-json']),
  options: PropTypes.oneOfType([PropTypes.array, PropTypes.func]),
  canBind: PropTypes.bool,
  params: PropTypes.object,
  fields: PropTypes.object,
  onChange: PropTypes.func
};

export default NodeBodyParam;
