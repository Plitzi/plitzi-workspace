import Icon from '@plitzi/plitzi-ui/Icon';

export const fieldParams = {
  text: { required: true, minLength: 5, maxLength: 30, multiline: false },
  richText: {},
  image: {},
  multiImage: {},
  video: {},
  link: {},
  email: {},
  phone: {},
  number: {},
  date: {},
  switch: {},
  color: {},
  option: {},
  file: {}
  // reference: {},
  // multiReference: {}
};

export const fieldParamsDefinition = {
  required: {},
  minLength: { label: 'Minimum character count (with spaces)', type: 'number' },
  maxLength: { label: 'Maximum character count (with spaces)', type: 'number' },
  multiline: {}
};

export const fieldTypes = {
  text: { icon: 'fas fa-font', label: 'Plain Text' },
  richText: { icon: 'fas fa-align-justify', label: 'Rich Text' },
  image: { icon: 'far fa-image', label: 'Image' },
  multiImage: { icon: 'far fa-images', label: 'Multi Image' },
  video: { icon: 'fab fa-youtube', label: 'Video Link' },
  link: { icon: 'fas fa-link', label: 'Link' },
  email: { icon: 'far fa-envelope', label: 'Email' },
  phone: { icon: 'fas fa-phone', label: 'Phone' },
  number: { icon: 'fas fa-hashtag', label: 'Number' },
  date: { icon: 'fas fa-calendar-day', label: 'Date / Time' },
  switch: { icon: 'fas fa-toggle-off', label: 'Switch' },
  color: { icon: 'fas fa-tint', label: 'Color' },
  option: { icon: '', label: 'Option' },
  file: { icon: 'far fa-file', label: 'File' }
  // reference: { icon: '', label: 'Reference' },
  // multiReference: { icon: '', label: 'Multi-reference' }
};

export const collectionFieldTypeToInteractions = (type: keyof typeof fieldParams | 'boolean') => {
  let finalType: 'boolean' | 'select' | 'text';
  switch (type) {
    case 'switch':
    case 'boolean':
      finalType = 'boolean';
      break;

    case 'option':
      finalType = 'select';
      break;

    // case 'image':
    // case 'multiImage':
    // case 'video':
    // case 'file':
    case 'text':
    case 'richText':
    case 'color':
    case 'link':
    case 'email':
    case 'phone':
    case 'number':
    case 'date':
    default:
      finalType = 'text';
  }

  return finalType;
};

export const fieldTypesOptions = Object.keys(fieldTypes).map(typeKey => ({
  label: typeKey,
  value: typeKey,
  icon: <Icon icon={fieldTypes[typeKey as keyof typeof fieldTypes].icon} size="xs" />
}));
