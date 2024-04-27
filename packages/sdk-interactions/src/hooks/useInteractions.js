// Packages
import { useContext, useLayoutEffect } from 'react';
import noop from 'lodash/noop';

// Relatives
import InteractionsContext from '../InteractionsContext';

/**
 * @param {{
 *   id: string;
 *   interactions?: object;
 *   triggers?: object;
 *   callbacks?: object;
 *   getAdditionalParams?: (params: object) => object;
 * }} props
 * @returns {React.ReactElement}
 */
const useInteractions = props => {
  const { id, interactions = {}, triggers = {}, callbacks = {}, getAdditionalParams = noop } = props;
  const { interactionsManager } = useContext(InteractionsContext);
  if (typeof window !== 'undefined') {
    useLayoutEffect(() => {
      interactionsManager.subscribe(id, interactions, triggers, callbacks, getAdditionalParams);

      return () => {
        interactionsManager.unsubscribe(id);
      };
    }, [id, interactions, triggers, callbacks, getAdditionalParams, interactionsManager]);
  }
};

export default useInteractions;
