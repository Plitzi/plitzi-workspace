// Packages
import PropTypes from 'prop-types';

// Relatives
import withUserInteractions from './hocs/withUserInteractions';
import withUserDataSource from './hocs/withUserDataSource';

const UserContextProvider = props => {
  const { children } = props;

  return children;
};

UserContextProvider.propTypes = {
  children: PropTypes.node
};

export default withUserInteractions(withUserDataSource(UserContextProvider));
