import JsxManager from './Element/JsxManager';
import * as elements from './elements';

export * from './elements';

export const defaultElements = {
  dropdown: elements.Dropdown,
  notFound: elements.NotFound,
  loading: elements.Loading,
  custom: elements.Custom,
  reference: elements.Reference,
  blockHtml: elements.BlockHtml,
  nodeHtml: elements.NodeHtml,
  blockJsx: elements.BlockJsx,
  page: elements.Page,
  container: elements.Container,
  layoutContainer: elements.LayoutContainer,
  dialogContainer: elements.DialogContainer,
  modalContainer: elements.ModalContainer,
  tabContainer: elements.TabContainer,
  heading: elements.Heading,
  image: elements.Image,
  video: elements.Video,
  fontAwesome: elements.FontAwesome,
  button: elements.Button,
  paragraph: elements.Paragraph,
  text: elements.Text,
  list: elements.List,
  link: elements.Link,
  markdown: elements.Markdown,
  form: elements.Form,
  formControl: elements.FormControl,
  apiContainer: elements.ApiContainer,
  collectionContainer: elements.CollectionContainer
};

export { elements, JsxManager };
