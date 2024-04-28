// Packages
import React from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';
import { useForm, Controller } from 'react-hook-form';
import Button from '@plitzi/plitzi-ui-components/Button';
import FormControl from '@plitzi/plitzi-ui-components/FormControl';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import { recordStatus } from '../CollectionsConstants';

const fieldsDefault = [];

/**
 * @param {{
 *   id?: string;
 *   fields?: object[];
 *   fieldHovered?: number;
 *   previewMode?: boolean;
 *   values?: object;
 *   onClose?: () => void;
 *   onSubmit?: (values: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const CollectionRecordForm = props => {
  const {
    id = '',
    fields = fieldsDefault,
    fieldHovered,
    previewMode = false,
    values = emptyObject,
    onClose = noop,
    onSubmit = noop
  } = props;

  const { control, handleSubmit } = useForm({ defaultValues: values });

  const handleSubmitInternal = values => onSubmit({ record: { id, status: recordStatus.STATUS_PUBLISHED, values } });

  // Pending do when is just created to publish later in the future

  return (
    <form
      className={classNames('flex flex-col justify-between overflow-auto p-3', { 'pointer-events-none': previewMode })}
      onSubmit={handleSubmit(handleSubmitInternal)}
    >
      {fields &&
        fields.map((field, i) => {
          const { machineName, name: fieldName, type, params, description } = field;

          return (
            <Controller
              key={i}
              control={control}
              rules={{ required: params.required }}
              name={machineName}
              render={({ field: { onChange, value, name }, fieldState: { error } }) => (
                <>
                  <FormControl
                    type={type}
                    name={name}
                    size="md"
                    label={
                      <>
                        {fieldName} {params.required && <span className="text-xs font-bold">(required)</span>}
                      </>
                    }
                    placeholder={fieldName}
                    className="w-full mb-4"
                    inputClassName={classNames('rounded', { 'bg-blue-200': fieldHovered === i })}
                    onChange={e => onChange(e.target.value)}
                    value={value}
                    error={error}
                  />
                  {description && <div className="text-xs">{description}</div>}
                </>
              )}
            />
          );
        })}
      {!previewMode && (
        <div className="flex justify-end">
          <Button onClick={onClose} className="mr-4 rounded-md">
            Cancel
          </Button>
          <Button type="submit" className="rounded-md">
            Publish
          </Button>
        </div>
      )}
    </form>
  );
};

export default CollectionRecordForm;
