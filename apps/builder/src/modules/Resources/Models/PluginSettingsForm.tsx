import classNames from 'classnames';

export type PluginSettingsFormProps = {
  className?: string;
  values?: object;
  onClose?: () => void;
  onSubmit?: (values: object) => void;
};

const PluginSettingsForm = ({ className = '' /* , values, onSubmit, onClose */ }: PluginSettingsFormProps) => {
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

export default PluginSettingsForm;
