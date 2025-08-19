import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm } from '@plitzi/plitzi-ui/Form';
import { useCallback, useMemo } from 'react';

import { makeCollectionRecordSchema } from './CollectionRecordFormHelper';

import type { CollectionField, CollectionRecord } from '@plitzi/sdk-shared';
import type { z } from 'zod';

export type CollectionRecordFormProps = {
  id?: string;
  fields?: CollectionField[];
  previewMode?: boolean;
  values?: CollectionRecord['values'];
  onClose?: () => void;
  onSubmit?: ({ record }: { record: Omit<CollectionRecord, 'createdAt' | 'updatedAt'> }) => void;
};

const CollectionRecordForm = ({
  id = '',
  fields,
  previewMode = false,
  values,
  onClose,
  onSubmit
}: CollectionRecordFormProps) => {
  const collectionRecordSchema = useMemo(() => makeCollectionRecordSchema(fields), [fields]);
  const form = useForm({
    initialValues: { id, status: 'published', values },
    config: { schema: collectionRecordSchema }
  });

  const handleSubmitInternal = useCallback(
    (record: z.infer<typeof collectionRecordSchema>) => onSubmit?.({ record }),
    [onSubmit]
  );

  // Pending do when is just created to publish later in the future

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="p-4">
      <Form.Body>
        {fields &&
          fields.map((field, i) => {
            const { machineName, name: fieldName, type, params } = field;
            const label = (
              <>
                {fieldName} {params.required && <span className="font-bold">(required)</span>}
              </>
            );

            switch (type) {
              case 'file':
                return <Form.FileUpload key={i} name={`values.${machineName}`} label={label} size="xs" />;
              case 'richText':
                return <Form.TextArea key={i} name={`values.${machineName}`} label={label} size="xs" />;
              case 'color':
                return <Form.Color key={i} name={`values.${machineName}`} label={label} size="xs" />;
              case 'switch':
                return <Form.Switch key={i} name={`values.${machineName}`} label={label} size="xs" />;
              // case 'date':
              //   return undefined
              // case 'option': (options are missing here)
              //   return <Form.Select name={machineName} label={label} size="xs"></Form.Select>;
              case 'text':
              case 'email':
              case 'number':
                return <Form.Input key={i} type={type} name={`values.${machineName}`} label={label} size="xs" />;

              default:
                return <Form.Input key={i} name={`values.${machineName}`} label={label} size="xs" />;
            }
          })}
        {!previewMode && (
          <div className="flex justify-end gap-4">
            <Button onClick={onClose} size="sm">
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Publish
            </Button>
          </div>
        )}
      </Form.Body>
    </Form>
  );

  // return (
  //   <form
  //     className={classNames('flex flex-col justify-between overflow-auto p-3', { 'pointer-events-none': previewMode })}
  //     onSubmit={handleSubmit(handleSubmitInternal)}
  //   >
  //     {fields &&
  //       fields.map((field, i) => {
  //         const { machineName, name: fieldName, type, params, description } = field;

  //         return (
  //           <Controller
  //             key={i}
  //             control={control}
  //             rules={{ required: params.required }}
  //             name={machineName}
  //             render={({ field: { onChange, value, name }, fieldState: { error } }) => (
  //               <>
  //                 <FormControl
  //                   type={type}
  //                   name={name}
  //                   size="md"
  //                   label={
  //                     <>
  //                       {fieldName} {params.required && <span className="text-xs font-bold">(required)</span>}
  //                     </>
  //                   }
  //                   placeholder={fieldName}
  //                   className="mb-4 w-full"
  //                   inputClassName={classNames('rounded-sm', { 'bg-blue-200': fieldHovered === i })}
  //                   onChange={e => onChange(e.target.value)}
  //                   value={value}
  //                   error={error}
  //                 />
  //                 {description && <div className="text-xs">{description}</div>}
  //               </>
  //             )}
  //           />
  //         );
  //       })}
  //     {!previewMode && (
  //       <div className="flex justify-end">
  //         <Button onClick={onClose} className="mr-4 rounded-md">
  //           Cancel
  //         </Button>
  //         <Button type="submit" className="rounded-md">
  //           Publish
  //         </Button>
  //       </div>
  //     )}
  //   </form>
  // );
};

export default CollectionRecordForm;
