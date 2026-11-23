import type { BuiltinActionSpec } from '@plitzi/sdk-shared/authoring';

/**
 * The share step, as the editor and anything authoring one offline read it: what is shared — an address, its title and
 * a line about it — each a template like any step's param. It answers `{ shared, copied }`: shared through the
 * device's own sheet, or, where there is none (a desktop's Firefox), the address copied for the visitor to paste.
 */
export const shareSpec: BuiltinActionSpec = {
  title: 'Share',
  type: 'utility',
  strictParams: true,
  params: {
    url: {
      type: 'text',
      description: 'The address to share. Empty, this page’s — {{ navigation.href }}.',
      default: '',
      label: 'Address'
    },
    title: {
      type: 'text',
      description: 'Its title, where the app it is shared to shows one.',
      default: '',
      label: 'Title'
    },
    text: { type: 'text', description: 'A line about it, said with the address.', default: '', label: 'Text' }
  }
};
