import JsxManager from './Element/JsxManager';
import RscContext from './Element/RscContext';
import RscProvider from './Element/RscProvider';
import * as elements from './elements';
import * as elementSettings from './elements/settings';

export { RscContext, RscProvider };
export type { RscContextValue } from './Element/RscContext';
export type { RscProviderProps } from './Element/RscProvider';
export { default as useRscData } from './Element/hooks/useRscData';

export * from './elements';
export * from './elements/settings';

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

export { elements, elementSettings, JsxManager };
