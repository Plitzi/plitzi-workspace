import declaration from './declaration';
import BaseDropdown from './Dropdown';
import DropdownPopup from './DropdownPopup';

// The sub-elements are React components, so they are attached here rather than in the data-only declaration.
const Dropdown = Object.assign(BaseDropdown, { ...declaration, plugins: { dropdownPopup: DropdownPopup } });

export default Dropdown;
