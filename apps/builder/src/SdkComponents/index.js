// Basic
import Text from './basic/Text/Settings';
import Paragraph from './basic/Paragraph/Settings';
import Button from './basic/Button/Settings';
import Link from './basic/Link/Settings';
import Heading from './basic/Heading/Settings';
import Dropdown from './basic/Dropdown/Settings';

// Structure
import Container from './structure/Container/Settings';
import List from './structure/List/Settings';
import TabContainer from './structure/TabContainer/Settings';
import DialogContainer from './structure/DialogContainer/Settings';
import ModalContainer from './structure/ModalContainer/Settings';

// Form
import Form from './form/Form/Settings';
import FormControl from './form/FormControl/Settings';

// Internal
import Page from './internal/Page/Settings';
import LayoutContainer from './internal/LayoutContainer/Settings';

// Media
import Image from './media/Image/Settings';
import Video from './media/Video/Settings';
import FontAwesome from './media/FontAwesome/Settings';

// Advanced
import Custom from './advanced/Custom/Settings';
import BlockHtml from './advanced/BlockHtml/Settings';
import PlitziSdk from './advanced/PlitziSdk/Settings';
import BlockJsx from './advanced/BlockJsx/Settings';
import Reference from './advanced/Reference/Settings';

// Provider
import ApiContainer from './provider/ApiContainer/Settings';
import CollectionContainer from './provider/CollectionContainer/Settings';

const defaultElementsSettings = {
  dropdown: Dropdown,
  plitziSdk: PlitziSdk,
  // notFound: NotFound,
  // loading: Loading,
  custom: Custom,
  reference: Reference,
  blockHtml: BlockHtml,
  blockJsx: BlockJsx,
  page: Page,
  container: Container,
  layoutContainer: LayoutContainer,
  dialogContainer: DialogContainer,
  modalContainer: ModalContainer,
  tabContainer: TabContainer,
  heading: Heading,
  image: Image,
  video: Video,
  fontAwesome: FontAwesome,
  button: Button,
  paragraph: Paragraph,
  text: Text,
  list: List,
  link: Link,
  form: Form,
  formControl: FormControl,
  apiContainer: ApiContainer,
  collectionContainer: CollectionContainer
};

export { defaultElementsSettings };
