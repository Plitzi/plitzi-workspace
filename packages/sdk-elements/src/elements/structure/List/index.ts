import declaration from './declaration';
import BaseList from './List';
import ListItem from './ListItem';

// The sub-elements are React components, so they are attached here rather than in the data-only declaration.
const List = Object.assign(BaseList, { ...declaration, plugins: { listItem: ListItem } });

export default List;
