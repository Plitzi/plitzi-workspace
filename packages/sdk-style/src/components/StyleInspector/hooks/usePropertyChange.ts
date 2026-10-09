import { use, useCallback } from 'react';

import StyleInspectorContext from '../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

/** What a `CategoryOption` hands its `onChange`: the union of every kind of control it can be. */
type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

/** A control's change handler for one property — `onChange={handleChange('width')}` — writing to what is selected. */
const usePropertyChange = () => {
  const { setValue } = use(StyleInspectorContext);

  return useCallback(
    // A control bound to one property hands one value: the wider union is `CategoryOption`'s, for all its kinds at once.
    (type: StyleCategory) => (value: OptionValue) => setValue(type, value as StyleValue),
    [setValue]
  );
};

export default usePropertyChange;
