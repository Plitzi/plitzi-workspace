// Packages
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
// import noop from 'lodash/noop';
// import emptyObject from '../../../helpers/utils';

const PluginSettingsForm = props => {
  const { className = '' /* , values = emptyObject, onSubmit = noop, onClose = noop */ } = props;
  // const handleSubmit = (isValid, values) => {
  //   if (isValid) {
  //     onSubmit(values);
  //   }
  // };

  return (
    <div className={classNames('w-full', className)}>
      {/* <Form onCancel={onClose} onSubmit={handleSubmit} values={values}>
        <FormContext.Consumer>
          {context => {
            const { onCancel, onSubmit } = context;

            return (
              <>
                {Object.keys(values).map(valueKey => (
                  <Form.Group key={valueKey} id={valueKey}>
                    <Form.Input placeholder={valueKey} />
                  </Form.Group>
                ))}
                <Form.Group className="form__footer group--inline text-end">
                  <button type="button" className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" onClick={onSubmit}>
                    Submit
                  </button>
                </Form.Group>
              </>
            );
          }}
        </FormContext.Consumer>
      </Form> */}
    </div>
  );
};

PluginSettingsForm.propTypes = {
  className: PropTypes.string,
  values: PropTypes.object,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func
};

export default PluginSettingsForm;
