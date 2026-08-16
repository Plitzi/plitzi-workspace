import declaration from './declaration';
import BaseTabContainer from './TabContainer';
import TabContainerBody from './TabContainerBody';
import TabContainerHeader from './TabContainerHeader';
import TabContainerItem from './TabContainerItem';

// The sub-elements are React components, so they are attached here rather than in the data-only declaration.
const TabContainer = Object.assign(BaseTabContainer, {
  ...declaration,
  plugins: {
    tabContainerHeader: TabContainerHeader,
    tabContainerBody: TabContainerBody,
    tabContainerItem: TabContainerItem
  }
});

export default TabContainer;
