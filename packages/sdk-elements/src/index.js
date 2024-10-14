// Relatives
// No relatives due that this is exporting all plitzi elements

// Basic
import Text from './components/basic/Text/index.js';
import Paragraph from './components/basic/Paragraph/index.js';
import Button from './components/basic/Button/index.js';
import Link from './components/basic/Link/index.js';
import Heading from './components/basic/Heading/index.js';
import Dropdown from './components/basic/Dropdown/index.js';
import Markdown from './components/basic/Markdown/index.js';

// Structure
import Container from './components/structure/Container/index.js';
import List from './components/structure/List/index.js';
import TabContainer from './components/structure/TabContainer/index.js';
import DialogContainer from './components/structure/DialogContainer/index.js';
import ModalContainer from './components/structure/ModalContainer/index.js';

// Form
import Form from './components/form/Form/index.js';
import FormControl from './components/form/FormControl/index.js';

// Internal
import NotFound from './components/internal/NotFound/index.js';
import Loading from './components/internal/Loading/index.js';
import Page from './components/internal/Page/index.js';
import LayoutContainer from './components/internal/LayoutContainer/index.js';

// Media
import Image from './components/media/Image/index.js';
import Video from './components/media/Video/index.js';
import FontAwesome from './components/media/FontAwesome/index.js';

// Advanced
import Custom from './components/advanced/Custom/index.js';
import BlockHtml from './components/advanced/BlockHtml/index.js';
import BlockJsx from './components/advanced/BlockJsx/index.js';
import Reference from './components/advanced/Reference/index.js';

// Provider
import ApiContainer from './components/provider/ApiContainer/index.js';
import CollectionContainer from './components/provider/CollectionContainer/index.js';

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
