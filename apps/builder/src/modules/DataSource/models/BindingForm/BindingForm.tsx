import Button from '@plitzi/plitzi-ui/Button';
import Form, { useForm, useFormWatch } from '@plitzi/plitzi-ui/Form';
import get from 'lodash/get';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import StepPreview from './steps/StepPreview';
import StepSettings from './steps/StepSettings';
import StepSource from './steps/StepSource';
import StepTransformers from './steps/StepTransformers';
import StepWhen from './steps/StepWhen';

import type { RuleGroup } from '@plitzi/plitzi-ui/QueryBuilder';
import type { ElementBinding, SourceField, SourceMeta } from '@plitzi/sdk-shared';

// eslint-disable-next-line react-refresh/only-export-components
export const bindingForm = z.object({
  id: z.string(),
  source: z.string(),
  fromPath: z.string(),
  toPath: z.string(),
  when: z.any().optional(),
  transformers: z.array(
    z.object({
      type: z.enum(['utility', 'abc']),
      action: z.string(),
      params: z.record(z.any())
    })
  )
});

export type BindingSchema = z.infer<typeof bindingForm>;

const attributesDefault = [];

export type BindingFormProps = {
  category?: string;
  attributes?: { label: string; path: string }[];
  sources: Record<string, SourceMeta>;
  value?: ElementBinding;
  allowCustomBindings?: boolean;
  onClose?: (success: boolean, data?: ElementBinding) => void;
};

const totalSteps = 4;

const BindingForm = ({
  category = '',
  attributes = attributesDefault,
  sources,
  value,
  allowCustomBindings = false,
  onClose
}: BindingFormProps) => {
  const form = useForm({
    initialValues: {
      id: '',
      source: '',
      fromPath: '',
      toPath: '',
      when: {},
      transformers: [],
      ...get(value, category, {})
    },
    config: { schema: bindingForm }
  });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataSourceFields, setDataSourceFields] = useState<Record<string, SourceField[]>>({});
  const watchSource = useFormWatch(form.formMethods, 'source');
  const watchWhen = useFormWatch(form.formMethods, 'when') as RuleGroup | undefined | Record<string, unknown>;

  const handleCancel = useCallback(() => onClose?.(false), [onClose]);

  const handleClickBack = useCallback(() => step > 0 && setStep(state => state - 1), [step]);

  const handleSubmitInternal = useCallback(
    (values: z.infer<typeof bindingForm>) => {
      if (step < totalSteps) {
        setStep(state => state + 1);
      } else {
        onClose?.(true, values as ElementBinding);
      }
    },
    [onClose, step]
  );

  const processFields = useCallback(async () => {
    setLoading(true);
    const fields = await Object.keys(sources).reduce(async (acum, source) => {
      let { fields: fieldsAux } = get(sources, source, {}) as SourceMeta;
      if (fieldsAux && typeof fieldsAux === 'function') {
        fieldsAux = await fieldsAux();
      }

      return { ...(await acum), [source]: fieldsAux ?? {} };
    }, Promise.resolve({}));
    setDataSourceFields(fields);
    setLoading(false);
  }, [sources]);

  useEffect(() => {
    void processFields();
  }, [processFields]);

  const fields = useMemo(() => get(dataSourceFields, watchSource, []), [dataSourceFields, watchSource]);

  const isSkipped = useMemo(() => {
    if (step === 2 && (!watchWhen || !watchWhen.rules || (watchWhen as RuleGroup).rules.length === 0)) {
      return true;
    }

    return false;
  }, [step, watchWhen]);

  return (
    <Form form={form} onSubmit={handleSubmitInternal} className="gap-4">
      <Form.Body>
        {step === 0 && <StepSource sources={sources} />}
        {!loading && (
          <>
            {step === 1 && (
              <StepSettings fields={fields} attributes={attributes} allowCustomBindings={allowCustomBindings} />
            )}
            {step === 2 && <StepWhen dataSourceFields={dataSourceFields} />}
            {step === 3 && <StepTransformers dataSourceFields={dataSourceFields} />}
            {step === 4 && <StepPreview sources={sources} fields={fields} category={category} />}
          </>
        )}
        {loading && 'Loading all sources...'}
      </Form.Body>
      <Form.Footer justify="between">
        <Button onClick={step === 0 ? handleCancel : handleClickBack} size="xs">
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button type="submit" size="xs">
          {step < totalSteps && (isSkipped ? 'Skip' : 'Next')}
          {step >= totalSteps && 'Save'}
        </Button>
      </Form.Footer>
    </Form>
  );
};

export default BindingForm;
