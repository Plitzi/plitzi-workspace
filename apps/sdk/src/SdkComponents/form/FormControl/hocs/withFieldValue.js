// Packages
import React, { forwardRef, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';

// Relatives
import usePlitziServiceContext from '../../../../services/hooks/usePlitziServiceContext';
import { emptyObject, getDisplayName } from '../../../../helpers/utils';

const withFieldValue = WrappedComponent => {
  const WithFieldValueComponent = forwardRef((props, ref) => {
    const { internalProps = emptyObject, name = '', subType = 'text', required = true } = props;
    const { id } = internalProps;
    const {
      settings: { previewMode },
      contexts: { DataSourceContext }
    } = usePlitziServiceContext();
    const { useDataSource } = useContext(DataSourceContext);
    const { form } = useDataSource({ id, mode: 'read' });
    if (!form) {
      return <WrappedComponent {...props} />;
    }

    const { setFieldValue, setFieldError, errors, values } = form;
    const value = useMemo(() => get(values, name, ''), [values, name]);
    const error = useMemo(() => {
      if (!previewMode) {
        return 'This is an error message';
      }

      return errors[name];
    }, [previewMode, errors, name]);

    const handleChange = useCallback(
      e => {
        if (typeof e?.checked === 'boolean' || subType === 'switch') {
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
  });

  WithFieldValueComponent.displayName = `withFieldValue(${getDisplayName(WrappedComponent)})`;

  WithFieldValueComponent.propTypes = {
    internalProps: PropTypes.object,
    name: PropTypes.string,
    subType: PropTypes.oneOf([
      'hidden',
      'text',
      'number',
      'email',
      'password',
      'select',
      'checkbox',
      'textarea',
      'color',
      'switch'
    ]),
    required: PropTypes.bool
  };

  return WithFieldValueComponent;
};

export default withFieldValue;
