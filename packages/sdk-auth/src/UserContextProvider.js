// Relatives
import withUserInteractions from './hocs/withUserInteractions';
import withUserDataSource from './hocs/withUserDataSource';

/**
 * @param {{
 *   children: React.ReactNode;
 * }} props
 * @returns {React.ReactElement}
 */
const UserContextProvider = props => {
  const { children } = props;

  return children;
};

export default withUserInteractions(withUserDataSource(UserContextProvider));
