// Packages
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import noop from 'lodash/noop';
import get from 'lodash/get';
import pick from 'lodash/pick';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Relatives
import StepSource from './steps/StepSource';
import StepSettings from './steps/StepSettings';
import StepTransformers from './steps/StepTransformers';
import StepPreview from './steps/StepPreview';
import StepWhen from './steps/StepWhen';

const attributesDefault = [];

/**
 * @param {{
 *   category?: string;
 *   attributes?: object[];
 *   sources?: object;
 *   value?: {
 *     attribute: string;
 *     source: string;
 *     fromPath: string;
 *     toPath: string;
 *   };
 *   allowCustomBindings?: boolean;
 *   className?: string;
 *   onClose?: (success: boolean, data: object) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const BindingForm = props => {
  const {
    category = '',
    attributes = attributesDefault,
    sources = emptyObject,
    value,
    allowCustomBindings = false,
    className = '',
    onClose = noop
  } = props;
  const [data, setData] = useState(() => get(value, category, {}));
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataSourceFields, setDataSourceFields] = useState({});

  const handleCancel = () => onClose(false);

  const handleClickBack = useCallback(() => {
    switch (step) {
      case 0:
        break;

      case 1:
        setStep(0);
        break;

      case 2:
        setStep(1);
        break;

      case 3:
        setStep(2);
        break;

      case 4:
        setStep(3);
        break;

      default:
    }
  }, [step]);

  const handleClickNext = useCallback(
    stepData => {
      switch (step) {
        case 0:
          setData(state => ({ ...state, ...stepData }));
          setStep(1);
          break;

        case 1:
          setData(state => ({ ...state, ...stepData }));
          setStep(2);
          break;

        case 2:
          setData(state => ({ ...state, ...stepData }));
          setStep(3);
          break;

        case 3:
          setData(state => ({ ...state, ...stepData }));
          setStep(4);
          break;

        case 4:
          onClose(true, data);
          break;

        default:
      }
    },
    [step, data]
  );

  const processFields = useCallback(async () => {
    setLoading(true);
    const fields = await Object.keys(sources).reduce(async (acum, source) => {
      let { fields: fieldsAux } = get(sources, source, {});
      if (fieldsAux && typeof fieldsAux === 'function') {
        fieldsAux = await fieldsAux(true);
      }

      return { ...(await acum), [source]: fieldsAux ?? {} };
    }, Promise.resolve({}));
    setDataSourceFields(fields);
    setLoading(false);
  }, [sources]);

  useEffect(() => {
    processFields();
  }, [processFields]);

  const fields = useMemo(() => get(dataSourceFields, data?.source, []), [dataSourceFields, data?.source]);

  if (step === 0) {
    return <StepSource sources={sources} {...data} onCancel={handleCancel} onNext={handleClickNext} />;
  }

  if (loading) {
    return 'Loading all sources...';
  }

  if (step === 1) {
    return (
      <StepSettings
        className={className}
        fields={fields}
        attributes={attributes}
        {...pick(data, ['fromPath', 'toPath'])}
        allowCustomBindings={allowCustomBindings}
        onBack={handleClickBack}
        onNext={handleClickNext}
      />
    );
  }

  if (step === 2) {
    return <StepWhen {...data} dataSourceFields={dataSourceFields} onBack={handleClickBack} onNext={handleClickNext} />;
  }

  if (step === 3) {
    return (
      <StepTransformers
        {...data}
        dataSourceFields={dataSourceFields}
        onBack={handleClickBack}
        onNext={handleClickNext}
      />
    );
  }

  if (step === 4) {
    return (
      <StepPreview {...data} sources={sources} fields={fields} onBack={handleClickBack} onNext={handleClickNext} />
    );
  }

  return null;
};

export default BindingForm;
