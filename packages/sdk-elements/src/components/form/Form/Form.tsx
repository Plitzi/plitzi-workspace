/* eslint-disable react-refresh/only-export-components */
import classNames from 'classnames';
import { produce } from 'immer';
import capitalize from 'lodash/capitalize';
import get from 'lodash/get';
import omit from 'lodash/omit';
import { useCallback, useMemo, useState, use } from 'react';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import withElement from '../../../Element/hocs/withElement';
import RootElement from '../../../Element/RootElement';

import type { DataSourceContextValue } from '@plitzi/sdk-data-source';
import type { InteractionsContextValue } from '@plitzi/sdk-interactions';
import type {
  SourceField,
  InternalPropsSTG2,
  InteractionBaseCallback,
  InteractionCallbackParamValues
} from '@plitzi/sdk-shared';
import type { FormEvent, ReactNode, RefObject } from 'react';

export type FormProps = {
  ref: RefObject<HTMLElement>;
  className: string;
  internalProps: InternalPropsSTG2;
  children: ReactNode;
  method: 'get' | 'post';
  actionUrl: string;
  managedByInteractions: boolean;
  errors: Record<string, string>;
  values: Record<string, unknown>;
};

export type Field = { id: string; name: string };
export type FieldValue = string | boolean | number;

const Form = ({
  ref,
  className = '',
  internalProps,
  children,
  method = 'get',
  actionUrl = '',
  managedByInteractions = false,
  errors = emptyObject,
  values = emptyObject
}: FormProps) => {
  const [fields, setFields] = useState<Record<string, SourceField>>({});
  const { id, setElementState } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext) as DataSourceContextValue;
  const { interactionsManager } = use(InteractionsContext) as InteractionsContextValue;

  const registerField = useCallback(
    (field: SourceField) => setFields(state => ({ ...state, [field.name]: field })),
    [setFields]
  );

  const getField = useCallback(
    (id: string) => {
      if (!id || !(fields[id] as SourceField | undefined)) {
        return fields;
      }

      return get(fields, id);
    },
    [fields]
  );

  const unregisterField = useCallback(
    (id: string) => {
      let name: string = '';
      setFields(state =>
        produce(state, draft => {
          if (!(draft[id] as SourceField | undefined)) {
            return;
          }

          name = draft[id].name;
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete draft[id];
        })
      );

      if (name) {
        setElementState(state => omit(state, `values.${name}`));
        setElementState(state => omit(state, `errors.${name}`));
      }
    },
    [setElementState]
  );

  const setFieldValue = useCallback(
    (name: string, value: FieldValue | null = '') => {
      if (!name) {
        return;
      }

      if (value === null) {
        value = '';
      }

      setElementState(state => ({ ...state, values: { ...state.values, [name]: value } }));
      setElementState(state => {
        if (!state?.errors || !state.errors[name]) {
          return state;
        }

        return { ...state, errors: omit(state.errors, [name]) };
      });
    },
    [setElementState]
  );

  const setFieldError = useCallback(
    (name: string, error: string) => {
      if (!name) {
        return;
      }

      setElementState(state => {
        if (!error && !get(state, `errors.${name}`)) {
          return state;
        }

        if (!error && state?.errors && state?.errors[name]) {
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
            { path: `fields.${field.name}.id`, name: `${capitalize(field.name)} ID` },
            { path: `values.${field.name}`, name: `${capitalize(field.name)} Value` },
            { path: `errors.${field.name}`, name: `${capitalize(field.name)} Error Message` }
          ],
          []
        ),
    [fields]
  );

  const contextValue = useMemo(
    () => ({ fields, errors, values, registerField, unregisterField, getField, setFieldValue, setFieldError }),
    [fields, errors, values, registerField, unregisterField, getField, setFieldValue, setFieldError]
  );
  const sourceName = useMemo(() => get(internalProps, 'definition.label', `Form - ${id}`), [id, internalProps]);

  const [FormContext] = useDataSource({
    id,
    source: 'form',
    mode: 'write',
    name: sourceName as string,
    fields: sourceFields
  });

  // Interactions Triggers

  const interactionTriggers = useMemo<Record<string, InteractionBaseCallback>>(
    () => ({
      onSubmit: {
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
    (e: FormEvent) => {
      setElementState(state => ({ ...state, errors: {} }));
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
    (params: InteractionCallbackParamValues | FormEvent) => {
      if (!managedByInteractions) {
        return;
      }

      if (params instanceof Event) {
        params.stopPropagation();
        params.preventDefault();
      }

      setElementState({ key: 'values', value: {} });
      setElementState({ key: 'errors', value: {} });
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

  const interactionCallbacks = useMemo<Record<string, InteractionBaseCallback>>(() => {
    const label = get(internalProps, 'definition.label', 'Form') as string;

    return {
      performReset: { title: `Reset ${label}`, type: 'callback', callback: handleReset, params: {} },
      setFieldValue: {
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
  }, [internalProps, handleReset, handleSetFieldValue, fields, handleSetFieldError]);

  return (
    <RootElement
      tag="form"
      ref={ref}
      internalProps={internalProps}
      method={method}
      className={classNames('plitzi-component__form', className)}
      interactionTriggers={interactionTriggers}
      interactionCallbacks={interactionCallbacks}
      onSubmit={handleSubmit}
      onReset={handleReset}
      action={actionUrl}
    >
      <FormContext value={contextValue}>{children}</FormContext>
    </RootElement>
  );
};

export default withElement(Form);

export { Form };
