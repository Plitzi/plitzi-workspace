// Packages
import { useMemo } from 'react';

// Monorepo
import { calculateBindings } from '@plitzi/sdk-style/StyleHelper';

const useStyleBinding = props => {
  const { element } = props;
  const bindingData = useMemo(() => calculateBindings(element), [element]);

  return bindingData;
};

export default useStyleBinding;
