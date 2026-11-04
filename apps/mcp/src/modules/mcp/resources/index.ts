// What edits a draft reads the catalogs from `../catalogs`, never from here: this barrel registers the resources on an
// MCP server, and that is its SDK in every process that previews a draft (`packageBoundary.test.ts`).
export { readPublicResource, readResource, resourceVersion } from './router';
export { actionSummaries } from './actions';
export { connectorSummaries } from './connectors';
export { registerResources } from './register';
export { resourceErrorMessage } from './canonical';
export { RENDER_GUIDE_URI, RENDER_TYPES_URI } from './renderGuide';

export {
  ambiguousShorthands,
  buildTypeRegistry,
  cssProperties,
  cssShorthands,
  expandShorthand,
  isCssProperty,
  suggestCssProperty
} from '../catalogs';
export type { TypeInfo, TypePropInfo, TypeRegistry } from '../catalogs';
export * from '../tools/operations/schema/translator';
export * from '../tools/operations/style/translator';
