/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/rules-of-hooks */
import clsx from 'clsx';
import { use, useEffect } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import Label from './components/Label';
import withFieldValue from './hocs/withFieldValue';
import Checkbox from './inputs/Checkbox';
import Hidden from './inputs/Hidden';
import Input from './inputs/Input';
import Select from './inputs/Select';
import Textarea from './inputs/Textarea';
import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { FormContextValue } from '../Form';
import type { InternalPropsSTG2 } from '@plitzi/sdk-shared';
import type { ChangeEvent, RefObject } from 'react';

export type FormControlProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalPropsSTG2;
  subType: 'text' | 'number' | 'email' | 'password' | 'time' | 'checkbox' | 'switch' | 'select' | 'textarea' | 'hidden';
  name: string;
  label: string;
  placeholder: string;
  autoComplete: boolean;
  disabled: boolean;
  options: { label: string; value: string }[];
  required: boolean;
  readOnly: boolean;
  value: string;
  error: string;
  handleChange: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | ChangeEvent<HTMLTextAreaElement>
  ) => void;
  handleValidate: () => void;
};

const FormControl = ({
  ref,
  className = '',
  internalProps,
  subType = 'text',
  name = '',
  label = 'Label',
  placeholder = '',
  autoComplete = true,
  disabled = false,
  options = [],
  required = true,
  readOnly = false,
  // HOC
  value = '', // HOC Managed
  error = '', // HOC Managed
  handleChange,
  handleValidate
}: FormControlProps) => {
  const {
    id,
    rootId,
    definition: { styleSelectors }
  } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext);
  const { form } = useDataSource<FormContextValue | undefined>({ id, mode: 'read' });
  if (!form && !previewMode) {
    return (
      <RootElement
        ref={ref}
        className={clsx('plitzi-component__form-input', { 'form-input--out-of-context': !previewMode }, className)}
      >
        <div>Form Input Only Works inside Form element</div>
      </RootElement>
    );
  }

  if (!form && previewMode) {
    return null;
  }

  const { registerField, unregisterField } = form as Partial<FormContextValue>;
  const isCheck = ['checkbox', 'switch'].includes(subType);

  useEffect(() => {
    if (registerField) {
      registerField({ name, path: name });
    }

    return () => {
      if (unregisterField) {
        unregisterField(name);
      }
    };
  }, [name, registerField, unregisterField]);

  return (
    <RootElement
      ref={ref}
      className={clsx(
        'plitzi-component__form-control',
        { 'form-control--invalid': error && previewMode, [`plitzi-component__form-control-${subType}`]: subType },
        className
      )}
    >
      {!isCheck && label && (
        <Label
          targetInput={`${rootId}_${id}`}
          previewMode={previewMode}
          className={styleSelectors.label}
          type={subType}
          required={required}
        >
          {label}
        </Label>
      )}
      {isCheck && label && (
        <Label
          targetInput={`${rootId}_${id}`}
          previewMode={previewMode}
          className={styleSelectors.label}
          type={subType}
          required={required}
        >
          {subType === 'checkbox' && (
            <Checkbox
              id={`${rootId}_${id}`}
              name={name}
              value={value}
              className={styleSelectors.input}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              onChange={handleChange}
              onValidate={handleValidate}
            />
          )}
          {/* {subType === 'switch' && (
            <Switch
              id={`${rootId}_${id}`}
              name={name}
              onChange={handleChange}
              value={value}
              size={size}
              className={inputClassName}
              hasError={!!errorMessage}
              disabled={disabled}
            />
          )} */}
          {label}
        </Label>
      )}
      {subType === 'checkbox' && !label && (
        <Checkbox
          id={`${rootId}_${id}`}
          name={name}
          value={value}
          className={styleSelectors.input}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onChange={handleChange}
          onValidate={handleValidate}
        />
      )}
      {/* {subType === 'switch' && !label && (
        <Switch
          {...inputProps}
          ref={ref}
          id={`${rootId}_${id}`}
          name={name}
          onChange={handleChange}
          value={value}
          size={size}
          className={inputClassName}
          hasError={!!errorMessage}
          disabled={disabled}
        />
      )} */}
      {['text', 'number', 'email', 'password', 'time'].includes(subType) && (
        <Input
          id={`${rootId}_${id}`}
          name={name}
          value={value}
          type={subType}
          className={styleSelectors.input}
          placeholder={placeholder}
          autoComplete={subType !== 'password' ? autoComplete : false}
          required={required}
          disabled={disabled}
          readOnly={readOnly || !previewMode}
          onChange={handleChange}
          onValidate={handleValidate}
        />
      )}
      {subType === 'hidden' && (
        <Hidden
          id={`${rootId}_${id}`}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          previewMode={previewMode}
        />
      )}
      {subType === 'select' && (
        <Select
          id={`${rootId}_${id}`}
          name={name}
          onChange={handleChange}
          onValidate={handleValidate}
          value={value}
          className={styleSelectors.input}
          placeholder={placeholder}
          disabled={disabled}
          options={options}
        />
      )}
      {subType === 'textarea' && (
        <Textarea
          id={`${rootId}_${id}`}
          name={name}
          value={value}
          className={styleSelectors.input}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          onChange={handleChange}
          onValidate={handleValidate}
        />
      )}
      {/* {subType === 'color' && (
        <ColorPicker
          {...inputProps}
          ref={ref}
          id={`${rootId}_${id}`}
          name={name}
          onChange={onChange}
          value={value}
          size={size}
          className={inputClassName}
          placeholder={placeholder}
          hasError={!!errorMessage}
          disabled={disabled}
        />
      )} */}
      {error && <div className={clsx('form-control__error-message', styleSelectors.error)}>{error}</div>}
    </RootElement>
  );
};

export default withElement(withFieldValue(FormControl));

export { FormControl };
