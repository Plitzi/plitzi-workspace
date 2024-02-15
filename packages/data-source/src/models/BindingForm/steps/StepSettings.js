// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import { useForm, Controller } from 'react-hook-form';
import classNames from 'classnames';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';
import Heading from '@plitzi/plitzi-ui-components/Heading';

const fieldsDefault = [];
const attributesDefault = [];

const StepSettings = props => {
  const {
    className = '',
    fields = fieldsDefault,
    attributes = attributesDefault,
    toPath = '',
    fromPath = '',
    allowCustomBindings = false,
    onBack = noop,
    onNext = noop
  } = props;
  const { control, handleSubmit } = useForm({ defaultValues: { toPath, fromPath } });

  const fromPathPropsMemo = useMemo(
    () => ({
      options: fields.reduce(
        (acum, field) => [...acum, { label: `${field.name} [${field.path}]`, value: field.path }],
        []
      ),
      allowCreateOptions: true
    }),
    [fields]
  );

  const toPathPropsMemo = useMemo(
    () => ({
      options: attributes.reduce(
        (acum, field) => [...acum, { label: `${field.label} [${field.path}]`, value: field.path }],
        []
      ),
      allowCreateOptions: allowCustomBindings
    }),
    [attributes, allowCustomBindings]
  );

  const handleClickBack = useCallback(() => onBack(), [onBack]);

  const handleSubmitInternal = useCallback(values => onNext(values), [onNext]);

  return (
    <form className={classNames('flex flex-col', className)} onSubmit={handleSubmit(handleSubmitInternal)}>
      <Heading type="h5" className="mb-4">
        Settings
      </Heading>
      <Controller
        control={control}
        rules={{ required: true }}
        name="toPath"
        render={({ field: { onChange, value, name }, fieldState: { error } }) => (
          <FormControl
            type="select2"
            name={name}
            size="md"
            placeholder="Attribute"
            className="w-full"
            inputClassName="rounded"
            onChange={option => onChange(option?.value ?? '')}
            value={value}
            error={error}
            inputProps={toPathPropsMemo}
          />
        )}
      />
      {fields && Array.isArray(fields) && (
        <Controller
          control={control}
          rules={{ required: true }}
          name="fromPath"
          render={({ field: { onChange, value, name }, fieldState: { error } }) => (
            <FormControl
              type="select2"
              name={name}
              size="md"
              placeholder="Select Path"
              className="w-full mt-4"
              inputClassName="rounded"
              onChange={option => onChange(option?.value ?? '')}
              value={value}
              error={error}
              inputProps={fromPathPropsMemo}
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

StepSettings.propTypes = {
  className: PropTypes.string,
  fields: PropTypes.array,
  attributes: PropTypes.array,
  fromPath: PropTypes.string,
  toPath: PropTypes.string,
  allowCustomBindings: PropTypes.bool,
  onNext: PropTypes.func,
  onBack: PropTypes.func
};

export default StepSettings;
