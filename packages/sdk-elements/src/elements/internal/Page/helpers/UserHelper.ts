import { get } from '@plitzi/plitzi-ui/helpers';

const isAuthenticated = (authData: { isAuthenticated: boolean }, userProvider = '', previewMode = true) => {
  let authenticated = false;
  switch (userProvider) {
    case 'plitzi':
      authenticated = get(authData, 'isAuthenticated', false) || !previewMode;
      break;

    case '':
    default:
  }

  return authenticated;
};

export { isAuthenticated };
