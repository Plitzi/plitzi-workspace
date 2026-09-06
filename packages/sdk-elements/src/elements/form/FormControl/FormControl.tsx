/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/rules-of-hooks */
import clsx from 'clsx';
import { use, useCallback, useEffect, useMemo } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import Label from './components/Label';
import withFieldValue from './hocs/withFieldValue';
import Checkbox from './inputs/Checkbox';
import Hidden from './inputs/Hidden';
import Input from './inputs/Input';
import Select from './inputs/Select';
import Textarea from './inputs/Textarea';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { FormContextValue } from '../Form';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { InteractionCallback } from '@plitzi/sdk-shared';
import type { ChangeEvent, RefObject } from 'react';

export type FormControlProps = {
  ref: RefObject<HTMLElement>;
  className: string;
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
  /**
   * Supplied by `withFieldValue` — and only when there is a form to supply it.
   *
   * A control outside a form is a state that HOC handles explicitly (it renders the component with none of its
   * additions), so these are optional in fact and were only ever required in the type. A select that filters a
   * screen is exactly such a control: nothing to submit, and the change itself is the event.
   */
  handleChange?: (
    e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | ChangeEvent<HTMLTextAreaElement>
  ) => void;
  handleValidate?: () => void;
};

const FormControl = ({
  ref,
  className = '',
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
  } = useElement();
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);
  const { useStore } = createStoreHook<{ runtime?: { sources?: { form?: FormContextValue } } }>();
  const [form] = useStore('runtime.sources.form');

  /**
   * A control that can drive something on its own.
   *
   * Until this, a field could only ever speak to the form around it: everything it knew went into `values` and left
   * on submit. That makes a select which FILTERS a screen impossible to author — there is nothing to submit, and the
   * change itself is the whole event.
   *
   * The value is handed over already read off the element, so a flow writes `{{ <trigger>.value }}` without knowing
   * whether it came from a checkbox or a text box.
   */
  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onChange: {
        action: 'onChange',
        title: 'On Change',
        type: 'trigger',
        params: {},
        preview: { value: '', name: '' }
      }
    }),
    []
  );

  const handleChangeInteraction = useCallback(
    (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | ChangeEvent<HTMLTextAreaElement>) => {
      // The form's own bookkeeping first, so a flow reading the form's values sees this change and not the one before.
      handleChange?.(e);
      if (!previewMode) {
        return;
      }

      const target = e.target as HTMLInputElement;
      const value = target.type === 'checkbox' || subType === 'switch' ? target.checked : target.value;
      void interactionsManager.interactionTrigger(id, 'onChange', { value, name });
    },
    [handleChange, previewMode, subType, interactionsManager, id, name]
  );
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
  // A hidden input has nothing to label, and the default label is a word rather than an empty string — so
  // authoring one without remembering to blank it puts "Label" and a box on the page above a field nobody can
  // see. The control itself is `display: none` in a real render; only the builder shows a placeholder for it.
  const isHidden = subType === 'hidden';

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
      interactionTriggers={interactionTriggers}
      className={clsx(
        'plitzi-component__form-control',
        { 'form-control--invalid': error && previewMode, [`plitzi-component__form-control-${subType}`]: subType },
        className
      )}
    >
      {!isCheck && !isHidden && label && (
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
              onChange={handleChangeInteraction}
              onValidate={handleValidate}
            />
          )}
          {/* {subType === 'switch' && (
            <Switch
              id={`${rootId}_${id}`}
              name={name}
              onChange={handleChangeInteraction}
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
          onChange={handleChangeInteraction}
          onValidate={handleValidate}
        />
      )}
      {/* {subType === 'switch' && !label && (
        <Switch
          {...inputProps}
          ref={ref}
          id={`${rootId}_${id}`}
          name={name}
          onChange={handleChangeInteraction}
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
          onChange={handleChangeInteraction}
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
          onChange={handleChangeInteraction}
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
          onChange={handleChangeInteraction}
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
