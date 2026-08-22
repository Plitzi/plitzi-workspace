import FormIcon from '@plitzi/plitzi-ui/icons/Form';

import declaration from './declaration';
import BaseForm from './Form';

// The catalogue icon is a React component, so it is attached here rather than in the data-only declaration —
// which has to stay importable from Node, where a seed or a migration authors a space without a browser.
const Form = Object.assign(BaseForm, {
  ...declaration,
  content: { ...declaration.content, market: { ...declaration.content.market, icon: <FormIcon /> } }
});

// eslint-disable-next-line react-refresh/only-export-components
export * from './Form';

export default Form;
