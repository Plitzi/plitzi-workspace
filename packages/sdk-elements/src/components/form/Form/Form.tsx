import React, { useCallback, useMemo, useState, use } from 'react';
import classNames from 'classnames';
import { produce } from 'immer';
import get from 'lodash/get';
import capitalize from 'lodash/capitalize';
import omit from 'lodash/omit';

import usePlitziServiceContext from '@plitzi/sdk-shared/usePlitziServiceContext';
import { emptyObject } from '@plitzi/sdk-shared/utils';

import RootElement from '../../../Element/RootElement';
import withElement from '../../../Element/hocs/withElement';

/**
 * @param {{
 *   ref: React.MutableRefObject<HTMLElement>;
 *   className: string;
 *   internalProps: object;
 *   children: React.ReactNode;
 *   method: 'get' | 'post';
 *   actionUrl: string;
 *   managedByInteractions: boolean;
 *   errors: object;
 *   values: object;
 * }} props
 * @returns {React.ReactElement}
 */
const Form = props => {
  const {
    ref,
    className = '',
    internalProps = emptyObject,
    children,
    method = 'get',
    actionUrl = '',
    managedByInteractions = false,
    errors = emptyObject,
    values = emptyObject
  } = props;
  const [fields, setFields] = useState({});
  const { id, setElementState } = internalProps;
  const {
    settings: { previewMode },
    contexts: { DataSourceContext, InteractionsContext }
  } = usePlitziServiceContext();
  const { useDataSource } = use(DataSourceContext);
  const { interactionsManager } = use(InteractionsContext);

  const registerField = useCallback(field => setFields(state => ({ ...state, [field.name]: field })), [setFields]);

  const getField = useCallback(
    id => {
      if (!id || !fields[id]) {
        return fields;
      }

      return get(fields, id);
    },
    [fields]
  );

  const unregisterField = useCallback(
    id => {
      let name;
      setFields(state =>
        produce(state, draft => {
          if (!draft[id]) {
            return;
          }

          name = draft[id]?.name;
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
    (name, value = '') => {
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
    (name, error) => {
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
    async () =>
      Object.values(fields)
        .filter(field => !!field?.name)
        .reduce(
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
  const sourceName = useMemo(
    () => get(internalProps, 'definition.label', `Form - ${id}`),
    [id, internalProps?.definition?.label]
  );

  const [FormContext] = useDataSource({ id, source: 'form', name: sourceName, fields: sourceFields });

  // Interactions Triggers

  const interactionTriggers = useMemo(
    () => ({
      onSubmit: {
        title: 'On Form Submit',
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
    e => {
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
      interactionsManager.interactionTrigger(id, 'onSubmit', { values: valuesParsed, actionUrl, method });
    },
    [fields, values, managedByInteractions, actionUrl, setElementState, previewMode, interactionsManager, method]
  );

  const handleReset = useCallback(
    e => {
      if (!managedByInteractions) {
        return;
      }

      if (e instanceof Event) {
        e.stopPropagation();
        e.preventDefault();
      }

      setElementState({ key: 'values', value: {} });
      setElementState({ key: 'errors', value: {} });
    },
    [setElementState, managedByInteractions]
  );

  const handleSetFieldValue = useCallback(
    params => {
      const { name, value } = params;

      setFieldValue(name, value);
    },
    [setFieldValue]
  );

  const handleSetFieldError = useCallback(
    params => {
      const { name, error } = params;
      setFieldError(name, error);
    },
    [setFieldError]
  );

  const interactionCallbacks = useMemo(() => {
    const label = get(internalProps, 'definition.label', 'Form');

    return {
      performReset: { title: `Reset ${label}`, callback: handleReset, params: {} },
      setFieldValue: {
        title: `Set Field Value ${label}`,
        callback: handleSetFieldValue,
        preview: {},
        params: {
          name: {
            label: 'Field Name',
            defaultValue: undefined,
            type: 'select',
            options: Object.values(fields).map(field => ({ value: field.name, label: field.name }))
          },
          value: ''
        }
      },
      setFieldError: {
        title: `Set Field Error ${label}`,
        callback: handleSetFieldError,
        preview: {},
        params: {
          name: {
            label: 'Field Name',
            defaultValue: undefined,
            type: 'select',
            options: Object.values(fields).map(field => ({ value: field.name, label: field.name }))
          },
          error: ''
        }
      }
    };
  }, [handleReset, fields, internalProps?.definition?.label, handleSetFieldValue, handleSetFieldError]);

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
