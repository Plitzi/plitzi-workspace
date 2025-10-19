export const collectionFieldTypeToInteractions = (type: string) => {
  let finalType = type;
  switch (type) {
    case 'switch':
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
