/* eslint-disable react-hooks/rules-of-hooks */
import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useEffect } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import { getDisplayName } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import { validateField } from '../helpers/validateField';

import type { FormContextValue } from '../../Form/Form';
import type { FieldRules } from '../helpers/validateField';
import type { ChangeEvent, FC, RefObject } from 'react';

export type WithFieldValueProps<T> = {
  ref: RefObject<HTMLElement>;
  name: string;
  defaultValue?: string;
  subType:
    'hidden' | 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'textarea' | 'color' | 'switch';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  matches?: string;
  matchesMessage?: string;
  previewError?: boolean;
} & T;

const withFieldValue = <T extends object>(WrappedComponent: FC<T>) => {
  const WithFieldValueComponent = (props: WithFieldValueProps<T>) => {
    const {
      ref,
      name = '',
      subType = 'text',
      defaultValue = '',
      required = true,
      minLength = 0,
      maxLength = 0,
      pattern = '',
      patternMessage = '',
      matches = '',
      matchesMessage = '',
      previewError = false
    } = props;
    const {
      settings: { previewMode }
    } = usePlitziServiceContext();
    const { useStore } = createStoreHook<{ runtime?: { sources?: { form?: FormContextValue } } }>();
    const [form] = useStore('runtime.sources.form');
    if (!form) {
      return <WrappedComponent {...props} />;
    }

    const { setFieldValue, setFieldError, registerValidator, unregisterValidator, errors, values } = form;
    const value = useMemo(() => get(values, name, defaultValue), [values, name, defaultValue]);
    const error = useMemo(() => {
      if (!previewMode && previewError) {
        return 'This is an error message';
      }

      return errors[name];
    }, [previewMode, previewError, errors, name]);

    const rules = useMemo<FieldRules>(
      () => ({ required, minLength, maxLength, pattern, patternMessage, matches, matchesMessage }),
      [required, minLength, maxLength, pattern, patternMessage, matches, matchesMessage]
    );

    /**
     * Handed to the form rather than run here, because the form is what decides whether a submit goes ahead — and it
     * has to ask every control at that moment, including the ones nobody has touched and so never blurred.
     */
    useEffect(() => {
      if (!name) {
        return undefined;
      }

      registerValidator(name, current => validateField(get(current, name, defaultValue), rules, current));

      return () => unregisterValidator(name);
    }, [name, defaultValue, rules, registerValidator, unregisterValidator]);

    useEffect(() => {
      if (defaultValue && value && name) {
        setFieldValue(name, value);
      }
    }, [defaultValue, name, setFieldValue, value]);

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.type === 'radio' || e.target.type === 'checkbox' || subType === 'switch') {
          setFieldValue(name, e.target.checked);
        } else {
          setFieldValue(name, e.target.value);
        }
      },
      [setFieldValue, name, subType]
    );

    const handleValidate = useCallback(
      () => setFieldError(name, validateField(value, rules, values)),
      [value, rules, values, name, setFieldError]
    );

    const WrappedComponentMemo = useMemo(
      () => (
        <WrappedComponent
          {...props}
          ref={ref}
          value={value}
          error={error}
          handleChange={handleChange}
          handleValidate={handleValidate}
        />
      ),
      [props, ref, error, value, handleChange, handleValidate]
    );

    return WrappedComponentMemo;
  };

  WithFieldValueComponent.displayName = `withFieldValue(${getDisplayName(WrappedComponent)})`;

  return WithFieldValueComponent;
};

export default withFieldValue;
