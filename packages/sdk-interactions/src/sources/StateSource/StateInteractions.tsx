import { useCallback, use, useMemo } from 'react';

import { useCommonStoreSetter } from '@plitzi/sdk-shared/store';

import InteractionsContext from '../../InteractionsContext';

import type { InteractionCallback, InteractionCallbackParamValues } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type StateInteractionsProps = {
  children?: ReactNode;
};

const StateInteractions = ({ children }: StateInteractionsProps) => {
  const { useInteractions } = use(InteractionsContext);
  const setState = useCommonStoreSetter() as (path: string, value: unknown) => void;

  const handleSetState = useCallback(
    (params: InteractionCallbackParamValues<{ key: string; type: string; value: string | boolean | number }>) => {
      const { key, type } = params;
      let { value } = params;
      if (type === 'boolean') {
        value = value === 'true';
      } else if (type === 'number') {
        value = parseInt(value as string, 10);
      }

      setState(`runtime.state.${key}`, value);
    },
    [setState]
  );

  const handleClearState = useCallback(() => {
    setState('runtime.state', {});
  }, [setState]);

  const interactionCallbacks = useMemo(
    () => ({
      setState: {
        action: 'setState',
        title: 'Set State',
        type: 'globalCallback',
        callback: handleSetState,
        preview: {},
        params: {
          key: { defaultValue: '', type: 'text' },
          type: {
            defaultValue: undefined,
            type: 'select',
            options: [
              { value: 'boolean', label: 'True / False' },
              { value: 'number', label: 'Numeric' },
              { value: 'text', label: 'Text' }
            ]
          },
          value: {
            defaultValue: undefined,
            type: params => (params.type === 'boolean' ? 'select' : 'text'),
            when: params => !!params.type,
            options: [
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' }
            ]
          }
        }
      } satisfies InteractionCallback<{ key: string; type: string; value: string }>,
      clearState: {
        action: 'clearState',
        title: 'Clear State',
        type: 'globalCallback',
        callback: handleClearState,
        preview: {},
        params: {}
      }
    }),
    [handleSetState, handleClearState]
  );

  useInteractions({
    id: 'state',
    callbacks: interactionCallbacks as unknown as Record<string, InteractionCallback>
  });

  return children;
};

export default StateInteractions;
