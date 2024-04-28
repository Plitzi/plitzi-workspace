// Packages
import React, { use, useEffect } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Monorepo
import { emptyObject } from '@plitzi/sdk-shared/utils';

// Alias
import withElement from '@modules/Element/hocs/withElement';
import RootElement from '@modules/Element/RootElement';

// Relatives
import usePlitziServiceContext from '../../../services/hooks/usePlitziServiceContext';
import Input from './inputs/Input';
import Checkbox from './inputs/Checkbox';
import Label from './components/Label';
import Select from './inputs/Select';
import Textarea from './inputs/Textarea';
import Hidden from './inputs/Hidden';
import withFieldValue from './hocs/withFieldValue';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   subType:
 *     | 'text'
 *     | 'number'
 *     | 'email'
 *     | 'password'
 *     | 'time'
 *     | 'checkbox'
 *     | 'switch'
 *     | 'select'
 *     | 'textarea'
 *     | 'hidden';
 *   name: string;
 *   label: string;
 *   placeholder: string;
 *   autoComplete: boolean;
 *   disabled: boolean;
 *   options: { label: string; value: string }[];
 *   required: boolean;
 *   readOnly: boolean;
 *   value: string;
 *   error: string;
 *   handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
 *   handleValidate: (e: React.ChangeEvent<HTMLInputElement>) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const FormControl = props => {
  const {
    ref,
    className = '',
    internalProps = emptyObject,
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
    handleChange = noop,
    handleValidate = noop
  } = props;
  const { id, rootId, styleSelectors } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext);
  const { form } = useDataSource({ id, mode: 'read' });
  if (!form && !previewMode) {
    return (
      <RootElement
        ref={ref}
        internalProps={internalProps}
        className={classNames(
          'plitzi-component__form-input',
          { 'form-input--out-of-context': !previewMode },
          className
        )}
      >
        <div>Form Input Only Works inside Form element</div>
      </RootElement>
    );
  }

  if (!form && previewMode) {
    return null;
  }

  const { registerField, unregisterField } = form;
  const isCheck = ['checkbox', 'switch'].includes(subType);

  useEffect(() => {
    if (registerField) {
      registerField({ id, name });
    }

    return () => {
      if (unregisterField) {
        unregisterField(id);
      }
    };
  }, [id, name, registerField, unregisterField]);

  return (
    <RootElement
      ref={ref}
      internalProps={internalProps}
      className={classNames(
        'plitzi-component__form-control',
        { 'form-control--invalid': error && previewMode, [`plitzi-component__form-control-${subType}`]: subType },
        className
      )}
    >
      {!isCheck && label && (
        <Label
          targetInput={`${rootId}-${id}`}
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
          targetInput={`${rootId}-${id}`}
          previewMode={previewMode}
          className={styleSelectors.label}
          type={subType}
          required={required}
        >
          {subType === 'checkbox' && (
            <Checkbox
              id={`${rootId}-${id}`}
              name={name}
              value={value}
              type={subType}
              className={styleSelectors.input}
              placeholder={placeholder}
              autoComplete={autoComplete}
              required={required}
              disabled={disabled}
              onChange={handleChange}
              onValidate={handleValidate}
            />
          )}
          {/* {subType === 'switch' && (
            <Switch
              id={`${rootId}-${id}`}
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
          id={`${rootId}-${id}`}
          name={name}
          value={value}
          type={subType}
          className={styleSelectors.input}
          placeholder={placeholder}
          autoComplete={autoComplete}
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
          id={`${rootId}-${id}`}
          name={name}
          onChange={handleChange}
          value={value}
          size={size}
          className={inputClassName}
          hasError={!!errorMessage}
          disabled={disabled}
        />
      )} */}
      {subType && ['text', 'number', 'email', 'password', 'time'].includes(subType) && (
        <Input
          id={`${rootId}-${id}`}
          name={name}
          value={value}
          type={subType}
          className={styleSelectors.input}
          placeholder={placeholder}
          autoComplete={subType !== 'password' ? autoComplete : false}
          required={required}
          disabled={disabled}
          readOnly={readOnly || !previewMode}
          previewMode={previewMode}
          onChange={handleChange}
          onValidate={handleValidate}
        />
      )}
      {subType === 'hidden' && (
        <Hidden
          id={`${rootId}-${id}`}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          previewMode={previewMode}
        />
      )}
      {subType === 'select' && (
        <Select
          id={`${rootId}-${id}`}
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
          id={`${rootId}-${id}`}
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
          id={`${rootId}-${id}`}
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
      {error && <div className={classNames('form-control__error-message', styleSelectors.error)}>{error}</div>}
    </RootElement>
  );
};

export default withElement(withFieldValue(FormControl));

export { FormControl };
