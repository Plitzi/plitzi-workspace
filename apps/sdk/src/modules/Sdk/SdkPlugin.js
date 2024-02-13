// Packages
import PropTypes from 'prop-types';

const SdkPlugin = () => null;

SdkPlugin.propTypes = {
  renderType: PropTypes.string,
  component: PropTypes.object,
  assets: PropTypes.arrayOf(PropTypes.object)
};

export default SdkPlugin;
