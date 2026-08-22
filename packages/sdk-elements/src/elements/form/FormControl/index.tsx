import FormIcon from '@plitzi/plitzi-ui/icons/Form';

import declaration from './declaration';
import BaseFormControl from './FormControl';

// The catalogue icon is a React component, so it is attached here rather than in the data-only declaration —
// which has to stay importable from Node, where a seed or a migration authors a space without a browser.
const FormControl = Object.assign(BaseFormControl, {
  ...declaration,
  content: { ...declaration.content, market: { ...declaration.content.market, icon: <FormIcon /> } }
});

export default FormControl;
