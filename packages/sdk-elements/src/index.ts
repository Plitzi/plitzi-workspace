import * as components from './components';
import JsxManager from './Element/JsxManager';

export * from './components';

export const defaultElements = {
  dropdown: components.Dropdown,
  notFound: components.NotFound,
  loading: components.Loading,
  custom: components.Custom,
  reference: components.Reference,
  blockHtml: components.BlockHtml,
  nodeHtml: components.NodeHtml,
  blockJsx: components.BlockJsx,
  page: components.Page,
  container: components.Container,
  layoutContainer: components.LayoutContainer,
  dialogContainer: components.DialogContainer,
  modalContainer: components.ModalContainer,
  tabContainer: components.TabContainer,
  heading: components.Heading,
  image: components.Image,
  video: components.Video,
  fontAwesome: components.FontAwesome,
  button: components.Button,
  paragraph: components.Paragraph,
  text: components.Text,
  list: components.List,
  link: components.Link,
  markdown: components.Markdown,
  form: components.Form,
  formControl: components.FormControl,
  apiContainer: components.ApiContainer,
  collectionContainer: components.CollectionContainer
};

export { components, JsxManager };
