// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import classNames from 'classnames';
import get from 'lodash/get';
import upperFirst from 'lodash/upperFirst';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Heading from '@plitzi/plitzi-ui-components/Heading';

const TransformerForm = props => {
  const {
    className = '',
    attributes,
    attribute = '',
    path = '',
    sources,
    source = '',
    onBack = noop,
    onNext = noop
  } = props;
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState([]);
  const pathPropsMemo = useMemo(
    () => ({ options: fields.reduce((acum, field) => [...acum, { label: field.path, value: field.path }], []) }),
    [fields]
  );

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

  const handleClickBack = useCallback(() => onBack(), [onBack]);

  const { control, handleSubmit } = useForm({ defaultValues: { attribute, path } });

  const handleSubmitInternal = values =>
    onNext({ ...values, name: fields.find(f => f.path === values.path).name ?? 'Unknown' });

  return (
    <form className={classNames('flex flex-col', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <Heading type="h5" className="mb-4">
        Binding Settings
      </Heading>
      <Controller
        control={control}
        rules={{ required: true }}
        name="attribute"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="select"
            name={name}
            size="md"
            placeholder="Attribute"
            className="w-full"
            inputClassName="rounded"
            onChange={e => onChange(e.target.value)}
            value={value}
            error={error}
          >
            {attributes.map((attr, i) => (
              <option key={i} value={attr}>
                {upperFirst(attr)}
              </option>
            ))}
          </FormControl>
        )}
      />
      {fields && Array.isArray(fields) && (
        <Controller
          control={control}
          rules={{ required: true }}
          name="path"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="select2"
              name={name}
              size="md"
              placeholder="Select Path"
              className="w-full mt-4"
              inputClassName="rounded w-full border-none !ring-0 !shadow-none cursor-pointer text-sm !p-0"
              disabled={loading}
              onChange={option => onChange(option.value)}
              value={value}
              error={error}
              inputProps={pathPropsMemo}
            />
          )}
        />
      )}
      <div className="flex justify-between mt-4">
        <Button onClick={handleClickBack} className="mr-4 rounded-md text-xs">
          Back
        </Button>
        <Button type="submit" className="rounded-md text-xs">
          Next
        </Button>
      </div>
    </form>
  );
};

TransformerForm.propTypes = {
  className: PropTypes.string,
  attributes: PropTypes.object,
  attribute: PropTypes.string,
  path: PropTypes.string,
  source: PropTypes.string,
  sources: PropTypes.object,
  onNext: PropTypes.func,
  onBack: PropTypes.func
};

export default TransformerForm;
