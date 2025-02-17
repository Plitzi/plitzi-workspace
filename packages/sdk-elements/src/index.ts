// No relatives due that this is exporting all plitzi elements

// Advanced
import BlockHtml from './components/advanced/BlockHtml';
import BlockJsx from './components/advanced/BlockJsx';
import Custom from './components/advanced/Custom';
import Reference from './components/advanced/Reference';
// Basic
import Button from './components/basic/Button';
import Dropdown from './components/basic/Dropdown';
import Heading from './components/basic/Heading';
import Link from './components/basic/Link';
import Markdown from './components/basic/Markdown';
import Paragraph from './components/basic/Paragraph';
import Text from './components/basic/Text';
// Form
import Form from './components/form/Form';
import FormControl from './components/form/FormControl';
// Internal
import LayoutContainer from './components/internal/LayoutContainer';
import Loading from './components/internal/Loading';
import NotFound from './components/internal/NotFound';
import Page from './components/internal/Page';
// Media
import FontAwesome from './components/media/FontAwesome';
import Image from './components/media/Image';
import Video from './components/media/Video';
// Provider
import ApiContainer from './components/provider/ApiContainer';
import CollectionContainer from './components/provider/CollectionContainer';
// Structure
import Container from './components/structure/Container';
import DialogContainer from './components/structure/DialogContainer';
import List from './components/structure/List';
import ModalContainer from './components/structure/ModalContainer';
import TabContainer from './components/structure/TabContainer';

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
