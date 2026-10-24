import useRscData from './Element/hooks/useRscData';
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
  carousel: elements.Carousel,
  heading: elements.Heading,
  image: elements.Image,
  video: elements.Video,
  embed: elements.Embed,
  svg: elements.Svg,
  fontAwesome: elements.FontAwesome,
  button: elements.Button,
  paragraph: elements.Paragraph,
  text: elements.Text,
  themeToggle: elements.ThemeToggle,
  list: elements.List,
  link: elements.Link,
  markdown: elements.Markdown,
  richText: elements.RichText,
  pagination: elements.Pagination,
  form: elements.Form,
  formControl: elements.FormControl,
  apiContainer: elements.ApiContainer,
  channel: elements.Channel
};

export { useRscData, elements, JsxManager };
export { default as useChannel } from './realtime/useChannel';
export { default as useJob } from './realtime/useJob';
export { default as useFlag } from './dataSource/useFlag';
export { default as PluginSource } from './dataSource/PluginSource';
export type { PluginSourceProps, PluginSourceDeclaration } from './dataSource/PluginSource';
export type { ChannelHandle, UseChannelOptions } from './realtime/useChannel';
export { default as withElement } from './Element/hocs/withElement';
export type { WithElementProps } from './Element/hocs/withElement';
export { default as useElement } from './Element/hooks/useElement';
export { default as PluginManager } from './Element/PluginManager';
export { default as PluginRemote } from './Element/PluginRemote';
export { default as ReplicaProvider } from './Element/ReplicaProvider';
export { default as RootElement } from './Element/RootElement';
export { default as elementChildren } from './Element/helpers/elementChildren';
export { default as useElementVisible } from './Element/hooks/useElementVisible';
export { default as usePluginTrigger } from './Element/hooks/usePluginTrigger';
export type { ElementContextValue } from './Element/ElementContext';
export type { ElementChild } from './Element/helpers/elementChildren';
export type { PluginTriggerPayload } from './Element/hooks/usePluginTrigger';
export { default as ElementContext } from './Element/ElementContext';
