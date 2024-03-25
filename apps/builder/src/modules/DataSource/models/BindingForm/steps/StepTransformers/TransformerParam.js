// Packages
import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import upperFirst from 'lodash/upperFirst';
import Input from '@plitzi/plitzi-ui-components/Input';
import Select2 from '@plitzi/plitzi-ui-components/Select2';
import TextArea from '@plitzi/plitzi-ui-components/TextArea';
import Checkbox from '@plitzi/plitzi-ui-components/Checkbox';
import CodeMirror from '@plitzi/plitzi-ui-components/CodeMirror';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

const optionsDefault = [];

const TransformerParam = props => {
  const {
    className = '',
    label: labelProp = '',
    id = '',
    value = '',
    type = 'text',
    options = optionsDefault,
    dataSourceFields = emptyObject,
    onChange = noop
  } = props;

  const handleChange = useCallback(
    e => {
      if (type === 'text' || type === 'textarea') {
        onChange(id, e.target.value);
      } else if (type === 'select') {
        onChange(id, e.value);
      } else if (type === 'checkbox') {
        onChange(id, e.target.checked);
      } else if (type === 'codemirror-text' || type === 'codemirror-json') {
        onChange(id, e);
      }
    },
    [id, onChange, type]
  );

  const label = useMemo(() => (!labelProp ? upperFirst(id) : labelProp), [labelProp, id]);

  const fieldsDataSource = useMemo(
    () => [
      ...Object.keys(dataSourceFields).reduce(
        (acum1, source) => [
          ...acum1,
          ...dataSourceFields[source].reduce((acum2, field) => [...acum2, `${source}.${field.path}`], [])
        ],
        []
      ),
      'source'
    ],
    [dataSourceFields]
  );

  return (
    <div className={classNames('flex flex-col w-full not-first:mt-4', className)}>
      <label htmlFor={id}>{label}</label>
      <div className="flex">
        {type === 'text' && (
          <Input className="w-full" size="sm" inputClassName="rounded" id={id} value={value} onChange={handleChange} />
        )}
        {type === 'select' && (
          <Select2
            className="rounded w-full"
            size="sm"
            placeholder={`Select a ${label}`}
            value={value}
            onChange={handleChange}
            options={options}
          />
        )}
        {type === 'textarea' && <TextArea className="rounded w-full" size="sm" value={value} onChange={handleChange} />}
        {type === 'checkbox' && <Checkbox onChange={handleChange} checked={value} />}
        {type === 'codemirror-text' && (
          <CodeMirror
            className="min-h-[80px]"
            value={value}
            theme="light"
            mode="text"
            autoComplete={fieldsDataSource}
            lineWrapping
            onChange={handleChange}
          />
        )}
      </div>
    </div>
  );
};

TransformerParam.propTypes = {
  className: PropTypes.string,
  id: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  label: PropTypes.string,
  type: PropTypes.oneOf(['text', 'select', 'textarea', 'checkbox', 'codemirror-text']),
  options: PropTypes.array,
  dataSourceFields: PropTypes.object,
  onChange: PropTypes.func
};

export default TransformerParam;
