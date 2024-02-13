// Packages
import { useContext, useLayoutEffect } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Relatives
import InteractionsContext from '../InteractionsContext';

const useInteractions = props => {
  const { id, interactions = {}, triggers = {}, callbacks = {}, getAdditionalParams = noop } = props;
  const { subscribe, unsubscribe } = useContext(InteractionsContext);
  if (typeof window !== 'undefined') {
    useLayoutEffect(() => {
      subscribe(id, interactions, triggers, callbacks, getAdditionalParams);

      return () => {
        unsubscribe(id);
      };
    }, [id, interactions, triggers, callbacks, getAdditionalParams]);
  }
};

useInteractions.propTypes = {
  id: PropTypes.string.isRequired,
  interactions: PropTypes.object,
  triggers: PropTypes.object,
  callbacks: PropTypes.object,
  getAdditionalParams: PropTypes.func
};

export default useInteractions;
