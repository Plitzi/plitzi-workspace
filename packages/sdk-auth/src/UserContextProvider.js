// Relatives
import withUserInteractions from './hocs/withUserInteractions';
import withUserDataSource from './hocs/withUserDataSource';

const UserContextProvider = props => {
  const { children } = props;

  return children;
};

export default withUserInteractions(withUserDataSource(UserContextProvider));
