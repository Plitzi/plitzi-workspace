/* eslint-disable react-refresh/only-export-components */
import { get, omit } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { produce } from 'immer';
import { useCallback, useMemo, useState, use, useEffect, useRef } from 'react';

import { StoreProvider } from '@plitzi/nexus/react';
import getSourceName from '@plitzi/sdk-shared/dataSource/helpers/getSourceName';
import useRegisterSource from '@plitzi/sdk-shared/dataSource/hooks/useRegisterSource';
import { emptyObject } from '@plitzi/sdk-shared/helpers/utils';
import usePlitziServiceContext from '@plitzi/sdk-shared/hooks/usePlitziServiceContext';

import declaration from './declaration';
import withElement from '../../../Element/hocs/withElement';
import useElement from '../../../Element/hooks/useElement';
import RootElement from '../../../Element/RootElement';

import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type { SourceField, InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode, RefObject, SyntheticEvent } from 'react';

export type FormProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  children: ReactNode;
  method: 'get' | 'post';
  actionUrl: string;
  managedByInteractions: boolean;
  errors: Record<string, string>;
  values: Record<string, unknown>;
};

export type Field = { id: string; name: string };
export type FieldValue = string | boolean | number;

/** What a control says about the form's values as they stand: the sentence to show under it, or `''`. */
export type FieldValidator = (values: Record<string, unknown>) => string;

export type FormContextValue = {
  errors: Record<string, string>;
  values: Record<string, unknown>;
  registerField: (field: SourceField) => void;
  unregisterField: (name: string) => void;
  registerValidator: (name: string, validate: FieldValidator) => void;
  unregisterValidator: (name: string) => void;
  setFieldValue: (name: string, value: FieldValue | null) => void;
  setFieldError: (name: string, error: string) => void;
};

const Form = ({
  ref,
  className = '',
  children,
  method = 'get',
  actionUrl = '',
  managedByInteractions = false,
  errors = emptyObject,
  values = emptyObject
}: FormProps) => {
  const [fields, setFields] = useState<Record<string, SourceField>>({});
  /**
   * Kept in a ref and not in state: a validator is a function each control re-creates when its rules change, and
   * nothing renders from the set — it is only ever read at the moment somebody submits.
   */
  const validators = useRef(new Map<string, FieldValidator>());
  const unmounting = useRef(false);
  const {
    id,
    definition: { label = 'Form' },
    setElementState
  } = useElement();
  const sourceName = getSourceName(declaration.sourceType, id);
  const {
    settings: { previewMode },
    contexts: { InteractionsContext }
  } = usePlitziServiceContext();
  const { interactionsManager } = use<InteractionsContextValue>(InteractionsContext);

  const registerField = useCallback(
    (field: SourceField) => setFields(state => ({ ...state, [field.name]: field })),
    [setFields]
  );

  useEffect(() => {
    unmounting.current = false;
    return () => {
      unmounting.current = true;
    };
  }, []);

  const unregisterField = useCallback(
    (name: string) => {
      if (unmounting.current) {
        return;
      }

      setFields(state =>
        produce(state, draft => {
          if (!(draft[name] as SourceField | undefined)) {
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete draft[name];
        })
      );

      if (name) {
        setElementState(state => ({
          ...state,
          values: omit(state, `values.${name}`),
          errors: omit(state, `errors.${name}`)
        }));
      }
    },
    [setElementState]
  );

  const registerValidator = useCallback((name: string, validate: FieldValidator) => {
    validators.current.set(name, validate);
  }, []);

  const unregisterValidator = useCallback((name: string) => {
    validators.current.delete(name);
  }, []);

  const setFieldValue = useCallback(
    (name: string, value: FieldValue | null = '') => {
      if (!name) {
        return;
      }

      if (value === null) {
        value = '';
      }

      setElementState<{ values?: Record<string, unknown>; errors?: Record<string, unknown> }>(state => {
        if (state.errors && state.errors[name]) {
          return { ...state, values: { ...state.values, [name]: value }, errors: omit(state.errors, [name]) };
        }

        return { ...state, values: { ...state.values, [name]: value } };
      });
    },
    [setElementState]
  );

  const setFieldError = useCallback(
    (name: string, error: string) => {
      if (!name) {
        return;
      }

      setElementState<{ errors: Record<string, unknown> | undefined }>(state => {
        if (!error && !get(state, `errors.${name}`)) {
          return state;
        }

        if (!error && state.errors && state.errors[name]) {
          return { ...state, errors: omit(state, [`errors.${name}`]) };
        }

        return { ...state, errors: { ...state.errors, [name]: error } };
      });
    },
    [setElementState]
  );

  const sourceFields = useCallback(
    () =>
      Object.values(fields)
        .filter(field => !!field.name)
        .reduce<SourceField[]>(
          (acum, field) => [
            ...acum,
            { path: `fields.${field.name}.id`, name: `${field.name} ID` },
            { path: `values.${field.name}`, name: `${field.name} Value` },
            { path: `errors.${field.name}`, name: `${field.name} Error Message` }
          ],
          []
        ),
    [fields]
  );

  /**
   * Published twice, and both are needed.
   *
   * `form` is the controls' own channel: the nearest form, and the callbacks they register through. `sourceName` is what
   * a BINDING reads — the builder lists this form's fields under it and authoring validates a binding against it — and
   * nothing used to publish it, so every binding to a form's values resolved to nothing, silently: a checklist that
   * ticks as a password is typed ticked nothing at all.
   */
  const contextValue = useMemo(
    () => ({
      runtime: {
        sources: {
          form: {
            errors,
            values,
            registerField,
            unregisterField,
            registerValidator,
            unregisterValidator,
            setFieldValue,
            setFieldError
          },
          [sourceName]: { values, errors }
        }
      }
    }),
    [
      sourceName,
      errors,
      values,
      registerField,
      unregisterField,
      registerValidator,
      unregisterValidator,
      setFieldValue,
      setFieldError
    ]
  );
  useRegisterSource({ id, source: sourceName, name: label ? label : `Form - ${id}`, fields: sourceFields });

  // Interactions Triggers

  const interactionTriggers = useMemo<Record<string, InteractionCallback>>(
    () => ({
      onSubmit: {
        action: 'onSubmit',
        title: 'On Form Submit',
        type: 'trigger',
        params: {},
        preview: {
          values: Object.values(fields).reduce((acum, field) => ({ ...acum, [field.name]: '' }), {}),
          actionUrl: '',
          method: ''
        }
      }
    }),
    [fields]
  );

  // Interactions Callbacks

  const handleSubmit = useCallback(
    (e: SyntheticEvent<HTMLFormElement>) => {
      const invalid = [...validators.current].reduce<Record<string, string>>((acum, [name, validate]) => {
        const message = validate(values);

        return message ? { ...acum, [name]: message } : acum;
      }, {});

      setElementState(state => ({ ...state, errors: invalid }));

      /**
       * Refused for every form, not only the managed ones.
       *
       * The browser only knows `required`; a length, a pattern or a confirmation that does not match is a rule it has
       * never heard of, so a form left to submit natively would carry exactly the values these rules exist to stop.
       */
      if (Object.keys(invalid).length > 0) {
        e.stopPropagation();
        e.preventDefault();

        return;
      }

      if (!managedByInteractions) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      if (!previewMode) {
        return;
      }

      const valuesParsed = Object.values(fields).reduce((acum, { name }) => ({ ...acum, [name]: values[name] }), {});
      void interactionsManager.interactionTrigger(id, 'onSubmit', { values: valuesParsed, actionUrl, method });
    },
    [setElementState, managedByInteractions, previewMode, fields, interactionsManager, id, actionUrl, method, values]
  );

  const handleReset = useCallback(
    (params: InteractionCallbackParamValues | SyntheticEvent<HTMLFormElement>) => {
      if (!managedByInteractions) {
        return;
      }

      if (params instanceof Event) {
        params.stopPropagation();
        params.preventDefault();
      }

      setElementState(state => ({ ...state, values: {}, errors: {} }));
    },
    [setElementState, managedByInteractions]
  );

  const handleSetFieldValue = useCallback(
    (params: InteractionCallbackParamValues) => {
      const { name, value } = params;
      setFieldValue(name as string, value as FieldValue);
    },
    [setFieldValue]
  );

  const handleSetFieldError = useCallback(
    (params: InteractionCallbackParamValues) => {
      const { name, error } = params;
      setFieldError(name as string, error as string);
    },
    [setFieldError]
  );

  const interactionCallbacks = useMemo<Record<string, InteractionCallback>>(() => {
    return {
      performReset: {
        action: 'performReset',
        title: `Reset ${label}`,
        type: 'callback',
        callback: handleReset,
        params: {}
      },
      setFieldValue: {
        action: 'setFieldValue',
        title: `Set Field Value ${label}`,
        type: 'callback',
        callback: handleSetFieldValue,
        preview: {},
        params: {
          name: {
            label: 'Field Name',
            defaultValue: undefined,
            type: 'select',
            options: Object.values(fields).map(field => ({ value: field.name, label: field.name }))
          },
          value: { type: 'text', defaultValue: '' }
        }
      },
      setFieldError: {
        action: 'setFieldError',
        title: `Set Field Error ${label}`,
        type: 'callback',
        callback: handleSetFieldError,
        preview: {},
        params: {
          name: {
            label: 'Field Name',
            defaultValue: undefined,
            type: 'select',
            options: Object.values(fields).map(field => ({ value: field.name, label: field.name }))
          },
          error: { type: 'text', defaultValue: '' }
        }
      }
    };
  }, [label, handleReset, handleSetFieldValue, fields, handleSetFieldError]);

  return (
    <RootElement
      tag="form"
      ref={ref}
      method={method}
      className={clsx('plitzi-component__form', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
      onSubmit={handleSubmit}
      onReset={handleReset}
      action={actionUrl}
    >
      <StoreProvider inherit="live" name={`Form:${id}`} value={contextValue}>
        {children}
      </StoreProvider>
    </RootElement>
  );
};

export default withElement(Form);

export { Form };
