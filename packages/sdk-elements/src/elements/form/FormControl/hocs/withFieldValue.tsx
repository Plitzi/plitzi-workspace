import { get } from '@plitzi/plitzi-ui/helpers';
import { useCallback, useMemo, useEffect, useState } from 'react';

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
    | 'hidden'
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'date'
    | 'time'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'color'
    | 'switch';
  required: boolean;
  requiredMessage?: string;
  minLength?: number;
  minLengthMessage?: string;
  maxLength?: number;
  maxLengthMessage?: string;
  formatMessage?: string;
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
      requiredMessage = '',
      minLength = 0,
      minLengthMessage = '',
      maxLength = 0,
      maxLengthMessage = '',
      formatMessage = '',
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
    /**
     * A control with no form around it keeps its own value.
     *
     * Nothing to submit, but plenty to do: a search box or a select that FILTERS a screen is exactly this, and its
     * `onChange` is the whole event. Without a value of its own the input was controlled by a constant and could not
     * be typed into — which is why it used to render nothing at all instead.
     *
     * `defaultValue` is followed when it changes, so a control bound to `state.query` shows a reset of that state.
     */
    const [ownValue, setOwnValue] = useState(defaultValue);
    const [followedDefault, setFollowedDefault] = useState(defaultValue);
    if (!form && followedDefault !== defaultValue) {
      setFollowedDefault(defaultValue);
      setOwnValue(defaultValue);
    }

    const values = form?.values;
    const value = useMemo(
      () => (form ? get(values, name, defaultValue) : ownValue),
      [form, values, name, defaultValue, ownValue]
    );
    const error = useMemo(() => {
      if (!previewMode && previewError) {
        return 'This is an error message';
      }

      return form?.errors[name] ?? '';
    }, [previewMode, previewError, form?.errors, name]);

    const rules = useMemo<FieldRules>(
      () => ({
        required,
        requiredMessage,
        minLength,
        minLengthMessage,
        maxLength,
        maxLengthMessage,
        type: subType,
        formatMessage,
        pattern,
        patternMessage,
        matches,
        matchesMessage
      }),
      [
        required,
        requiredMessage,
        minLength,
        minLengthMessage,
        maxLength,
        maxLengthMessage,
        subType,
        formatMessage,
        pattern,
        patternMessage,
        matches,
        matchesMessage
      ]
    );

    const registerValidator = form?.registerValidator;
    const unregisterValidator = form?.unregisterValidator;
    const setFieldValue = form?.setFieldValue;
    const setFieldError = form?.setFieldError;

    /**
     * Handed to the form rather than run here, because the form is what decides whether a submit goes ahead — and it
     * has to ask every control at that moment, including the ones nobody has touched and so never blurred.
     */
    useEffect(() => {
      if (!name || !registerValidator || !unregisterValidator) {
        return undefined;
      }

      registerValidator(name, current => validateField(get(current, name, defaultValue), rules, current));

      return () => unregisterValidator(name);
    }, [name, defaultValue, rules, registerValidator, unregisterValidator]);

    useEffect(() => {
      if (setFieldValue && defaultValue && value && name) {
        setFieldValue(name, value);
      }
    }, [defaultValue, name, setFieldValue, value]);

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        const checkable = e.target.type === 'radio' || e.target.type === 'checkbox' || subType === 'switch';
        if (!setFieldValue) {
          setOwnValue(checkable ? String(e.target.checked) : e.target.value);

          return;
        }

        setFieldValue(name, checkable ? e.target.checked : e.target.value);
      },
      [setFieldValue, name, subType]
    );

    // A standalone control has no submit to guard, so there is nothing for its rules to stop.
    const handleValidate = useCallback(
      () => setFieldError?.(name, validateField(value, rules, values ?? {})),
      [value, rules, values, name, setFieldError]
    );

    return useMemo(
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
  };

  WithFieldValueComponent.displayName = `withFieldValue(${getDisplayName(WrappedComponent)})`;

  return WithFieldValueComponent;
};

export default withFieldValue;
