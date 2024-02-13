const callback = (source, params) => {
  const { valueType, value } = params;
  if (valueType === 'select') {
    return value === 'true';
  }

  return value;
};

const staticValue = {
  action: 'staticValue',
  title: 'Static Value',
  type: 'utility',
  params: {
    valueType: {
      label: 'Value Type',
      defaultValue: 'text',
      type: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Long Text', value: 'textarea' },
        { label: 'Boolean', value: 'select' }
      ]
    },
    value: {
      defaultValue: '',
      type: ({ valueType }) => valueType,
      options: [
        { label: 'True', value: 'true' },
        { label: 'False', value: 'false' }
      ]
    }
  },
  preview: { valueType: '', value: '' },
  callback
};

export default staticValue;
