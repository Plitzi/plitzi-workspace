// Basic
import Text from './components/basic/Text';
import Paragraph from './components/basic/Paragraph';
import Button from './components/basic/Button';
import Link from './components/basic/Link';
import Heading from './components/basic/Heading';
import Dropdown from './components/basic/Dropdown';
import Markdown from './components/basic/Markdown';

// Structure
import Container from './components/structure/Container';
import List from './components/structure/List';
import TabContainer from './components/structure/TabContainer';
import DialogContainer from './components/structure/DialogContainer';
import ModalContainer from './components/structure/ModalContainer';

// Form
import Form from './components/form/Form';
import FormControl from './components/form/FormControl';

// Internal
import NotFound from './components/internal/NotFound';
import Loading from './components/internal/Loading';
import Page from './components/internal/Page';
import LayoutContainer from './components/internal/LayoutContainer';

// Media
import Image from './components/media/Image';
import Video from './components/media/Video';
import FontAwesome from './components/media/FontAwesome';

// Advanced
import Custom from './components/advanced/Custom';
import BlockHtml from './components/advanced/BlockHtml';
import BlockJsx from './components/advanced/BlockJsx';
import Reference from './components/advanced/Reference';

// Provider
import ApiContainer from './components/provider/ApiContainer';
import CollectionContainer from './components/provider/CollectionContainer';

const defaultElements = {
  dropdown: Dropdown,
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
  markdown: Markdown,
  form: Form,
  formControl: FormControl,
  apiContainer: ApiContainer,
  collectionContainer: CollectionContainer
};

export default defaultElements;
