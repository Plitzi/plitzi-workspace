/* eslint-disable react-refresh/only-export-components */
import clsx from 'clsx';
import { use, useCallback, useEffect } from 'react';

import { createStoreHook } from '@plitzi/nexus/react';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import Label from './components/Label';
import { VISUALLY_HIDDEN } from './components/visuallyHidden';
import declaration from './declaration';
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
import type { ChangeEvent, RefObject } from 'react';

export type FormControlProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  subType:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    /** A search box: the browser draws its clear button, and a phone shows its search key. */
    | 'search'
    | 'url'
    /** A phone number: a phone shows its dial pad. */
    | 'tel'
    | 'date'
    | 'time'
    | 'checkbox'
    | 'switch'
    | 'select'
    | 'textarea'
    | 'hidden'
    /** The browser's own colour picker: its value is `#rrggbb`. */
    | 'color';
  name: string;
  label: string;
  /**
   * Keeps `label` out of sight while it still names the field — for a field whose design already says what it is for:
   * a search box with a magnifier, a colour swatch. Without a label a screen reader or a browser agent finds an unnamed
   * box; a placeholder names only a text field, and only until something is typed.
   */
  hideLabel: boolean;
  placeholder: string;
  autoComplete: boolean;
  /**
   * Takes the focus as it appears — a search box opened by a shortcut is typed into at once. With the control's
   * container shown only while wanted (`loadStrategy: 'visible'`), it appears each time it is opened.
   */
  autoFocus: boolean;
  disabled: boolean;
  options: { label: string; value: string }[];
  required: boolean;
  /**
   * The rules a value has to meet before the form submits, checked by the form at submit time and by the control when
   * it loses focus. `0` and `''` mean no rule. See `validateField` for what each one says when it is broken.
   *
   * Each `…Message` is the sentence shown under the control when that rule is broken, in the site's language; empty
   * falls back to an English one. `formatMessage` speaks for the shape the control's own type asks of its value — an
   * address, for an `email` — so it is one attribute however many types come to have a shape.
   */
  requiredMessage: string;
  minLength: number;
  minLengthMessage: string;
  maxLength: number;
  maxLengthMessage: string;
  formatMessage: string;
  pattern: string;
  patternMessage: string;
  /** The `name` of another control in the same form this one has to repeat — a password confirmation, typically. */
  matches: string;
  matchesMessage: string;
  readOnly: boolean;
  value: string;
  error: string;
  /**
   * Supplied by `withFieldValue`, with or without a form around the control.
   *
   * Inside a form the value is the form's; outside one it is the control's own, so a select that filters a screen
   * works on its own — nothing to submit, and its `onChange` is the whole event. Validation only runs inside a form.
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
  hideLabel = false,
  placeholder = '',
  autoComplete = true,
  autoFocus = false,
  disabled = false,
  options = [],
  required = true,
  maxLength = 0,
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
    visible,
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

  const handleChangeInteraction = useCallback(
    (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLSelectElement> | ChangeEvent<HTMLTextAreaElement>) => {
      // The form's own bookkeeping first, so a flow reading the form's values sees this change and not the one before.
      handleChange?.(e);
      if (!previewMode) {
        return;
      }

      const { target } = e;
      const checkable = target instanceof HTMLInputElement && (target.type === 'checkbox' || subType === 'switch');
      const value = checkable ? target.checked : target.value;
      void interactionsManager.interactionTrigger(id, 'onChange', { value, name });
    },
    [handleChange, previewMode, subType, interactionsManager, id, name]
  );
  const registerField = form?.registerField;
  const unregisterField = form?.unregisterField;
  const isCheck = ['checkbox', 'switch'].includes(subType);
  // A hidden input has nothing to label, and the default label is a word rather than an empty string — so
  // authoring one without remembering to blank it puts "Label" and a box on the page above a field nobody can
  // see. The control itself is `display: none` in a real render; only the builder shows a placeholder for it.
  const isHidden = subType === 'hidden';
  // Every time it is shown — a search bar opened a second time takes the focus again — and never in the builder.
  const focusWhenShown = autoFocus && previewMode && visible;
  const errorId = error && previewMode ? `${rootId}_${id}_error` : undefined;

  useEffect(() => {
    if (!registerField || !unregisterField) {
      return undefined;
    }

    registerField({ name, path: name });

    return () => unregisterField(name);
  }, [name, registerField, unregisterField]);

  return (
    <RootElement
      ref={ref}
      interactionTriggers={declaration.triggers}
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
          hidden={hideLabel && previewMode}
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
              errorId={errorId}
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
          {hideLabel && previewMode ? <span style={VISUALLY_HIDDEN}>{label}</span> : label}
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
          errorId={errorId}
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
      {['text', 'number', 'email', 'password', 'search', 'url', 'tel', 'date', 'time', 'color'].includes(subType) && (
        <Input
          id={`${rootId}_${id}`}
          name={name}
          value={value}
          type={subType}
          className={styleSelectors.input}
          placeholder={placeholder}
          autoComplete={subType !== 'password' ? autoComplete : false}
          autoFocus={focusWhenShown}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly || !previewMode}
          onChange={handleChangeInteraction}
          onValidate={handleValidate}
          errorId={errorId}
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
          errorId={errorId}
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
          autoFocus={focusWhenShown}
          required={required}
          maxLength={maxLength}
          disabled={disabled}
          readOnly={readOnly}
          onChange={handleChangeInteraction}
          onValidate={handleValidate}
          errorId={errorId}
        />
      )}
      {error && (
        <div id={errorId} role="alert" className={clsx('form-control__error-message', styleSelectors.error)}>
          {error}
        </div>
      )}
    </RootElement>
  );
};

export default withElement(withFieldValue(FormControl));

export { FormControl };
