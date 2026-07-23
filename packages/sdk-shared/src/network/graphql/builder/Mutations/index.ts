import CollectionAddMutation from './Collection/CollectionAddMutation';
import CollectionAddRecordMutation from './Collection/CollectionAddRecordMutation';
import CollectionRemoveMutation from './Collection/CollectionRemoveMutation';
import CollectionRemoveRecordMutation from './Collection/CollectionRemoveRecordMutation';
import CollectionUpdateMutation from './Collection/CollectionUpdateMutation';
import CollectionUpdateRecordMutation from './Collection/CollectionUpdateRecordMutation';
import SegmentAddMutation from './Segment/SegmentAddMutation';
import SegmentAddTemplateMutation from './Segment/SegmentAddTemplateMutation';
import SegmentPublishMutation from './Segment/SegmentPublishMutation';
import SegmentRemoveMutation from './Segment/SegmentRemoveMutation';
import SegmentUpdateMutation from './Segment/SegmentUpdateMutation';
import SegmentAddElementMutation from './Segment/space/elements/SegmentAddElementMutation';
import SegmentCloneElementMutation from './Segment/space/elements/SegmentCloneElementMutation';
import SegmentMoveElementMutation from './Segment/space/elements/SegmentMoveElementMutation';
import SegmentRemoveElementMutation from './Segment/space/elements/SegmentRemoveElementMutation';
import SegmentUpdateElementMutation from './Segment/space/elements/SegmentUpdateElementMutation';
import SegmentSpaceAddVariableMutation from './Segment/space/variables/SegmentSpaceAddVariableMutation';
import SegmentSpaceRemoveVariableMutation from './Segment/space/variables/SegmentSpaceRemoveVariableMutation';
import SegmentSpaceUpdateVariableMutation from './Segment/space/variables/SegmentSpaceUpdateVariableMutation';
import SegmentStyleAddSelectorMutation from './Segment/style/selectors/SegmentStyleAddSelectorMutation';
import SegmentStyleRemoveSelectorMutation from './Segment/style/selectors/SegmentStyleRemoveSelectorMutation';
import SegmentStyleRemoveSelectorsMutation from './Segment/style/selectors/SegmentStyleRemoveSelectorsMutation';
import SegmentStyleUpdateSelectorMutation from './Segment/style/selectors/SegmentStyleUpdateSelectorMutation';
import SegmentStyleAddSelectorVariableMutation from './Segment/style/selectorVariables/SegmentStyleAddSelectorVariableMutation';
import SegmentStyleRemoveSelectorVariableMutation from './Segment/style/selectorVariables/SegmentStyleRemoveSelectorVariableMutation';
import SegmentStyleUpdateSelectorVariableMutation from './Segment/style/selectorVariables/SegmentStyleUpdateSelectorVariableMutation';
import SegmentStyleAddVariableMutation from './Segment/style/variables/SegmentStyleAddVariableMutation';
import SegmentStyleRemoveVariableMutation from './Segment/style/variables/SegmentStyleRemoveVariableMutation';
import SegmentStyleUpdateVariableMutation from './Segment/style/variables/SegmentStyleUpdateVariableMutation';
import SpaceAddCdnMutation from './Space/cdns/SpaceAddCdnMutation';
import SpaceRemoveCdnMutation from './Space/cdns/SpaceRemoveCdnMutation';
import SpaceSetCdnCredentialMutation from './Space/cdns/SpaceSetCdnCredentialMutation';
import SpaceUpdateCdnMutation from './Space/cdns/SpaceUpdateCdnMutation';
import SpaceAddCredentialMutation from './Space/credentials/SpaceAddCredentialMutation';
import SpaceRemoveCredentialMutation from './Space/credentials/SpaceRemoveCredentialMutation';
import SpaceUpdateCredentialMutation from './Space/credentials/SpaceUpdateCredentialMutation';
import SpaceAddPageFolderMutation from './Space/folders/SpaceAddPageFolderMutation';
import SpaceRemovePageFolderMutation from './Space/folders/SpaceRemovePageFolderMutation';
import SpaceUpdatePageFolderMutation from './Space/folders/SpaceUpdatePageFolderMutation';
import SpaceAddPageMutation from './Space/pages/SpaceAddPageMutation';
import SpaceHomePageMutation from './Space/pages/SpaceHomePageMutation';
import SpaceRemovePageMutation from './Space/pages/SpaceRemovePageMutation';
import SpaceUpdatePageMutation from './Space/pages/SpaceUpdatePageMutation';
import SpaceAddResourceMutation from './Space/resources/SpaceAddResourceMutation';
import SpaceMoveResourceMutation from './Space/resources/SpaceMoveResourceMutation';
import SpaceRemoveResourceMutation from './Space/resources/SpaceRemoveResourceMutation';
import SpaceAddElementMutation from './Space/SpaceAddElementMutation';
import SpaceAddPluginMutation from './Space/SpaceAddPluginMutation';
import SpaceAddTemplateMutation from './Space/SpaceAddTemplateMutation';
import SpaceCloneElementMutation from './Space/SpaceCloneElementMutation';
import SpaceDeployMutation from './Space/SpaceDeployMutation';
import SpaceMoveElementMutation from './Space/SpaceMoveElementMutation';
import SpacePublishMutation from './Space/SpacePublishMutation';
import SpaceRemoveElementMutation from './Space/SpaceRemoveElementMutation';
import SpaceRemovePluginMutation from './Space/SpaceRemovePluginMutation';
import SpaceUpdateElementMutation from './Space/SpaceUpdateElementMutation';
import SpaceUpdateMutation from './Space/SpaceUpdateMutation';
import SpaceUpdatePluginMutation from './Space/SpaceUpdatePluginMutation';
import SpaceUpdateSchemaMutation from './Space/SpaceUpdateSchemaMutation';
import SpaceUpdateSettingsMutation from './Space/SpaceUpdateSettingsMutation';
import SpaceAddVariableMutation from './Space/variables/SpaceAddVariableMutation';
import SpaceRemoveVariableMutation from './Space/variables/SpaceRemoveVariableMutation';
import SpaceUpdateVariableMutation from './Space/variables/SpaceUpdateVariableMutation';
import StyleAddSelectorMutation from './Style/selectors/StyleAddSelectorMutation';
import StyleRemoveSelectorMutation from './Style/selectors/StyleRemoveSelectorMutation';
import StyleRemoveSelectorsMutation from './Style/selectors/StyleRemoveSelectorsMutation';
import StyleUpdateSelectorMutation from './Style/selectors/StyleUpdateSelectorMutation';
import StyleAddSelectorVariableMutation from './Style/selectorVariables/StyleAddSelectorVariableMutation';
import StyleRemoveSelectorVariableMutation from './Style/selectorVariables/StyleRemoveSelectorVariableMutation';
import StyleUpdateSelectorVariableMutation from './Style/selectorVariables/StyleUpdateSelectorVariableMutation';
import StyleUpdateMutation from './Style/StyleUpdateMutation';
import StyleUpdateSettingsMutation from './Style/StyleUpdateSettingsMutation';
import StyleAddVariableMutation from './Style/variables/StyleAddVariableMutation';
import StyleRemoveVariableMutation from './Style/variables/StyleRemoveVariableMutation';
import StyleUpdateVariableMutation from './Style/variables/StyleUpdateVariableMutation';

import type { TCollectionAddMutation } from './Collection/CollectionAddMutation';
import type { TCollectionAddRecordMutation } from './Collection/CollectionAddRecordMutation';
import type { TCollectionRemoveMutation } from './Collection/CollectionRemoveMutation';
import type { TCollectionRemoveRecordMutation } from './Collection/CollectionRemoveRecordMutation';
import type { TCollectionUpdateMutation } from './Collection/CollectionUpdateMutation';
import type { TCollectionUpdateRecordMutation } from './Collection/CollectionUpdateRecordMutation';
import type { TSegmentAddMutation } from './Segment/SegmentAddMutation';
import type { TSegmentPublishMutation } from './Segment/SegmentPublishMutation';
import type { TSegmentUpdateMutation } from './Segment/SegmentUpdateMutation';
import type { TSpaceAddCdnMutation } from './Space/cdns/SpaceAddCdnMutation';
import type { TSpaceRemoveCdnMutation } from './Space/cdns/SpaceRemoveCdnMutation';
import type { TSpaceSetCdnCredentialMutation } from './Space/cdns/SpaceSetCdnCredentialMutation';
import type { TSpaceUpdateCdnMutation } from './Space/cdns/SpaceUpdateCdnMutation';
import type { TSpaceAddPageFolderMutation } from './Space/folders/SpaceAddPageFolderMutation';
import type { TSpaceRemovePageFolderMutation } from './Space/folders/SpaceRemovePageFolderMutation';
import type { TSpaceUpdatePageFolderMutation } from './Space/folders/SpaceUpdatePageFolderMutation';
import type { TSpaceAddPageMutation } from './Space/pages/SpaceAddPageMutation';
import type { TSpaceHomePageMutation } from './Space/pages/SpaceHomePageMutation';
import type { TSpaceRemovePageMutation } from './Space/pages/SpaceRemovePageMutation';
import type { TSpaceUpdatePageMutation } from './Space/pages/SpaceUpdatePageMutation';
import type { TSpaceAddResourceMutation } from './Space/resources/SpaceAddResourceMutation';
import type { TSpaceMoveResourceMutation } from './Space/resources/SpaceMoveResourceMutation';
import type { TSpaceRemoveResourceMutation } from './Space/resources/SpaceRemoveResourceMutation';
import type { TSpaceAddPluginMutation } from './Space/SpaceAddPluginMutation';
import type { TSpaceDeployMutation } from './Space/SpaceDeployMutation';
import type { TSpacePublishMutation } from './Space/SpacePublishMutation';
import type { TSpaceUpdatePluginMutation } from './Space/SpaceUpdatePluginMutation';

export type BuilderMutationsMap = {
  SpaceUpdate: unknown;
  SpaceUpdateSchema: unknown;
  SpaceAddPage: TSpaceAddPageMutation;
  SpaceHomePage: TSpaceHomePageMutation;
  SpaceUpdatePage: TSpaceUpdatePageMutation;
  SpaceRemovePage: TSpaceRemovePageMutation;
  SpaceAddPageFolder: TSpaceAddPageFolderMutation;
  SpaceUpdatePageFolder: TSpaceUpdatePageFolderMutation;
  SpaceRemovePageFolder: TSpaceRemovePageFolderMutation;
  SpaceAddVariable: unknown;
  SpaceUpdateVariable: unknown;
  SpaceRemoveVariable: unknown;
  SpaceAddElement: unknown;
  SpaceUpdateElement: unknown;
  SpaceRemoveElement: unknown;
  SpaceMoveElement: unknown;
  SpaceCloneElement: unknown;
  SpaceAddTemplate: unknown;
  SpaceAddPlugin: TSpaceAddPluginMutation;
  SpaceUpdatePlugin: TSpaceUpdatePluginMutation;
  SpaceRemovePlugin: unknown;
  SpaceAddResource: TSpaceAddResourceMutation;
  SpaceMoveResource: TSpaceMoveResourceMutation;
  SpaceRemoveResource: TSpaceRemoveResourceMutation;
  SpaceAddCdn: TSpaceAddCdnMutation;
  SpaceUpdateCdn: TSpaceUpdateCdnMutation;
  SpaceSetCdnCredential: TSpaceSetCdnCredentialMutation;
  SpaceRemoveCdn: TSpaceRemoveCdnMutation;
  SpaceAddCredential: unknown;
  SpaceUpdateCredential: unknown;
  SpaceRemoveCredential: unknown;
  SpacePublish: TSpacePublishMutation;
  SpaceDeploy: TSpaceDeployMutation;
  SpaceUpdateSettings: unknown;

  StyleAddSelector: unknown;
  StyleUpdateSelector: unknown;
  StyleRemoveSelector: unknown;
  StyleRemoveSelectors: unknown;
  StyleAddSelectorVariable: unknown;
  StyleUpdateSelectorVariable: unknown;
  StyleRemoveSelectorVariable: unknown;
  StyleAddVariable: unknown;
  StyleUpdateVariable: unknown;
  StyleRemoveVariable: unknown;
  StyleUpdate: unknown;
  StyleUpdateSettings: unknown;

  SegmentAdd: TSegmentAddMutation;
  SegmentUpdate: TSegmentUpdateMutation;
  SegmentRemove: unknown;
  SegmentAddElement: unknown;
  SegmentUpdateElement: unknown;
  SegmentRemoveElement: unknown;
  SegmentMoveElement: unknown;
  SegmentCloneElement: unknown;
  SegmentAddTemplate: unknown;
  SegmentSpaceAddVariable: unknown;
  SegmentSpaceUpdateVariable: unknown;
  SegmentSpaceRemoveVariable: unknown;
  SegmentStyleAddSelector: unknown;
  SegmentStyleUpdateSelector: unknown;
  SegmentStyleRemoveSelector: unknown;
  SegmentStyleRemoveSelectors: unknown;
  SegmentStyleAddSelectorVariable: unknown;
  SegmentStyleRemoveSelectorVariable: unknown;
  SegmentStyleUpdateSelectorVariable: unknown;
  SegmentStyleAddVariable: unknown;
  SegmentStyleUpdateVariable: unknown;
  SegmentStyleRemoveVariable: unknown;
  SegmentPublish: TSegmentPublishMutation;

  CollectionAdd: TCollectionAddMutation;
  CollectionUpdate: TCollectionUpdateMutation;
  CollectionRemove: TCollectionRemoveMutation;
  CollectionAddRecord: TCollectionAddRecordMutation;
  CollectionUpdateRecord: TCollectionUpdateRecordMutation;
  CollectionRemoveRecord: TCollectionRemoveRecordMutation;
};

const BuilderMutations = {
  SpaceUpdate: SpaceUpdateMutation,
  SpaceUpdateSchema: SpaceUpdateSchemaMutation,
  SpaceAddPage: SpaceAddPageMutation,
  SpaceHomePage: SpaceHomePageMutation,
  SpaceUpdatePage: SpaceUpdatePageMutation,
  SpaceRemovePage: SpaceRemovePageMutation,
  SpaceAddPageFolder: SpaceAddPageFolderMutation,
  SpaceUpdatePageFolder: SpaceUpdatePageFolderMutation,
  SpaceRemovePageFolder: SpaceRemovePageFolderMutation,
  SpaceAddVariable: SpaceAddVariableMutation,
  SpaceUpdateVariable: SpaceUpdateVariableMutation,
  SpaceRemoveVariable: SpaceRemoveVariableMutation,
  SpaceAddElement: SpaceAddElementMutation,
  SpaceUpdateElement: SpaceUpdateElementMutation,
  SpaceRemoveElement: SpaceRemoveElementMutation,
  SpaceMoveElement: SpaceMoveElementMutation,
  SpaceCloneElement: SpaceCloneElementMutation,
  SpaceAddTemplate: SpaceAddTemplateMutation,
  SpaceAddPlugin: SpaceAddPluginMutation,
  SpaceUpdatePlugin: SpaceUpdatePluginMutation,
  SpaceRemovePlugin: SpaceRemovePluginMutation,
  SpaceAddResource: SpaceAddResourceMutation,
  SpaceMoveResource: SpaceMoveResourceMutation,
  SpaceRemoveResource: SpaceRemoveResourceMutation,
  SpaceAddCdn: SpaceAddCdnMutation,
  SpaceUpdateCdn: SpaceUpdateCdnMutation,
  SpaceSetCdnCredential: SpaceSetCdnCredentialMutation,
  SpaceRemoveCdn: SpaceRemoveCdnMutation,
  SpaceAddCredential: SpaceAddCredentialMutation,
  SpaceUpdateCredential: SpaceUpdateCredentialMutation,
  SpaceRemoveCredential: SpaceRemoveCredentialMutation,
  SpacePublish: SpacePublishMutation,
  SpaceDeploy: SpaceDeployMutation,
  SpaceUpdateSettings: SpaceUpdateSettingsMutation,

  StyleAddSelector: StyleAddSelectorMutation,
  StyleUpdateSelector: StyleUpdateSelectorMutation,
  StyleRemoveSelector: StyleRemoveSelectorMutation,
  StyleRemoveSelectors: StyleRemoveSelectorsMutation,
  StyleAddSelectorVariable: StyleAddSelectorVariableMutation,
  StyleUpdateSelectorVariable: StyleUpdateSelectorVariableMutation,
  StyleRemoveSelectorVariable: StyleRemoveSelectorVariableMutation,
  StyleAddVariable: StyleAddVariableMutation,
  StyleUpdateVariable: StyleUpdateVariableMutation,
  StyleRemoveVariable: StyleRemoveVariableMutation,
  StyleUpdate: StyleUpdateMutation,
  StyleUpdateSettings: StyleUpdateSettingsMutation,

  SegmentAdd: SegmentAddMutation,
  SegmentUpdate: SegmentUpdateMutation,
  SegmentRemove: SegmentRemoveMutation,
  SegmentAddElement: SegmentAddElementMutation,
  SegmentUpdateElement: SegmentUpdateElementMutation,
  SegmentRemoveElement: SegmentRemoveElementMutation,
  SegmentMoveElement: SegmentMoveElementMutation,
  SegmentCloneElement: SegmentCloneElementMutation,
  SegmentAddTemplate: SegmentAddTemplateMutation,
  SegmentSpaceAddVariable: SegmentSpaceAddVariableMutation,
  SegmentSpaceRemoveVariable: SegmentSpaceRemoveVariableMutation,
  SegmentSpaceUpdateVariable: SegmentSpaceUpdateVariableMutation,
  SegmentStyleAddSelector: SegmentStyleAddSelectorMutation,
  SegmentStyleUpdateSelector: SegmentStyleUpdateSelectorMutation,
  SegmentStyleRemoveSelector: SegmentStyleRemoveSelectorMutation,
  SegmentStyleRemoveSelectors: SegmentStyleRemoveSelectorsMutation,
  SegmentStyleAddSelectorVariable: SegmentStyleAddSelectorVariableMutation,
  SegmentStyleRemoveSelectorVariable: SegmentStyleRemoveSelectorVariableMutation,
  SegmentStyleUpdateSelectorVariable: SegmentStyleUpdateSelectorVariableMutation,
  SegmentStyleAddVariable: SegmentStyleAddVariableMutation,
  SegmentStyleUpdateVariable: SegmentStyleUpdateVariableMutation,
  SegmentStyleRemoveVariable: SegmentStyleRemoveVariableMutation,
  SegmentPublish: SegmentPublishMutation,

  CollectionAdd: CollectionAddMutation,
  CollectionUpdate: CollectionUpdateMutation,
  CollectionRemove: CollectionRemoveMutation,
  CollectionAddRecord: CollectionAddRecordMutation,
  CollectionUpdateRecord: CollectionUpdateRecordMutation,
  CollectionRemoveRecord: CollectionRemoveRecordMutation
};

export default BuilderMutations;
