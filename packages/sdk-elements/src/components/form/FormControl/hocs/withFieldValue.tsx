/* eslint-disable react-hooks/rules-of-hooks */
import get from 'lodash-es/get.js';
import { useCallback, use, useMemo, useEffect } from 'react';

import { getDisplayName } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import type { FieldValue } from '../../Form/Form';
import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ChangeEvent, FC, RefObject } from 'react';

export type WithFieldValueProps<T> = {
  ref: RefObject<HTMLElement>;
  internalProps: InternalPropsSTG2;
  name: string;
  defaultValue?: string;
  subType:
    | 'hidden'
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'color'
    | 'switch';
  required: boolean;
  previewError?: boolean;
} & T;

const withFieldValue = <T extends object>(WrappedComponent: FC<T>) => {
  const WithFieldValueComponent = (props: WithFieldValueProps<T>) => {
    const {
      ref,
      internalProps,
      name = '',
      subType = 'text',
      defaultValue = '',
      required = true,
      previewError = false
    } = props;
    const { id } = internalProps;
    const {
      settings: { previewMode },
      contexts: { DataSourceContext }
    } = usePlitziServiceContext();
    const { useDataSource } = use(DataSourceContext);
    const { form } = useDataSource<
      | {
          setFieldValue: (name: string, value: FieldValue | null) => void;
          setFieldError: (name: string, error: string) => void;
          errors: Record<string, string>;
          values: Record<string, string | boolean | number>;
        }
      | undefined
    >({ id, mode: 'read' });
    if (!form) {
      return <WrappedComponent {...props} />;
    }

    const { setFieldValue, setFieldError, errors, values } = form;
    const value = useMemo(() => get(values, name, defaultValue), [values, name, defaultValue]);
    const error = useMemo(() => {
      if (!previewMode && previewError) {
        return 'This is an error message';
      }

      return errors[name];
    }, [previewMode, previewError, errors, name]);

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

    const handleValidate = useCallback(() => {
      if (!value && required) {
        setFieldError(name, 'This field is required');
      } else if (error === 'This field is required') {
        setFieldError(name, '');
      }
    }, [value, error, name, required, setFieldError]);

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
