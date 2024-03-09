// Packages
import { useMemo } from 'react';

// Relatives
import { calculateBindings } from '../StyleHelper';

const useStyleBinding = props => {
  const { element } = props;
  const bindingData = useMemo(() => calculateBindings(element), [element]);

  return bindingData;
};

export default useStyleBinding;
