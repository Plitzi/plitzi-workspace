import { useMemo } from 'react';

import { calculateBindings } from '../../../StyleHelper';

import type { Element } from '@plitzi/sdk-shared';

export type UseStyleBindingProps = { element?: Element };

const useStyleBinding = ({ element }: UseStyleBindingProps) => useMemo(() => calculateBindings(element), [element]);

export default useStyleBinding;
