/**
 * Which space a request is for — its domain, a free sub-domain, a credential, an authoring preview — and the cache that
 * keeps the answer: the resolution a page server renders with, apart from the renderer. A process that serves no pages
 * (a worker, an API) resolves spaces through this and loads nothing of React or the SDK.
 */
export {
  authoringPreview,
  createMemoryCache,
  createSpaceAdapters,
  fixedSpace,
  parsePreviewLabel,
  presentsCredential,
  PREVIEW_KEY_LENGTH,
  previewLabel,
  refuse,
  renderGrant,
  snapshotPreview,
  verifiedDomain,
  wildcardSubdomain
} from './adapters/space';
export type {
  AuthoringPreviewOptions,
  DeploymentRow,
  PreviewAddress,
  RenderGrantOptions,
  SnapshotPreviewOptions,
  SpaceAdapters,
  SpaceAdaptersConfig,
  SpaceCache,
  SpaceRefusal,
  SpaceResolution,
  SpaceResolver,
  WildcardSubdomainOptions
} from './adapters/space';
