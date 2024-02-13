// Basic
import Text from './basic/Text';
import Paragraph from './basic/Paragraph';
import Button from './basic/Button';
import Link from './basic/Link';
import Heading from './basic/Heading';
import Dropdown from './basic/Dropdown';

// Structure
import Container from './structure/Container';
import List from './structure/List';
import TabContainer from './structure/TabContainer';
import DialogContainer from './structure/DialogContainer';
import ModalContainer from './structure/ModalContainer';

// Form
import Form from './form/Form';
import FormControl from './form/FormControl';

// Internal
import NotFound from './internal/NotFound';
import Loading from './internal/Loading';
import Page from './internal/Page';
import LayoutContainer from './internal/LayoutContainer';

// Media
import Image from './media/Image';
import Video from './media/Video';
import FontAwesome from './media/FontAwesome';

// Advanced
import Custom from './advanced/Custom';
import BlockHtml from './advanced/BlockHtml';
import PlitziSdk from './advanced/PlitziSdk';
import BlockJsx from './advanced/BlockJsx';
import Reference from './advanced/Reference';

// Provider
import ApiContainer from './provider/ApiContainer';
import CollectionContainer from './provider/CollectionContainer';

const defaultElements = {
  dropdown: Dropdown,
  plitziSdk: PlitziSdk,
  notFound: NotFound,
  loading: Loading,
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

export { defaultElements };
