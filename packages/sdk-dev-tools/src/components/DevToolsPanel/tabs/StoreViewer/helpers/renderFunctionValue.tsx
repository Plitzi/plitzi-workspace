import { readFunctionLabel } from './mapFunctionValues';

import type { TypesElement } from '@uiw/react-json-view';

// Strings tagged by `mapFunctionValues` are painted as a function chip — returning nothing leaves every other string to
// the viewer's own renderer.
const renderFunctionValue: NonNullable<TypesElement<'span'>['render']> = (_props, { type, value }) => {
  if (type !== 'value' || typeof value !== 'string') {
    return null;
  }

  const label = readFunctionLabel(value);
  if (!label) {
    return null;
  }

  return <span className="w-rjv-value text-violet-400 italic">{label}</span>;
};

export default renderFunctionValue;
