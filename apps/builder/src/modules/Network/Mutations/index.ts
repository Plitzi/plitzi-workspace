import CollectionAddMutation from './Collection/CollectionAddMutation';
import CollectionAddRecordMutation from './Collection/CollectionAddRecordMutation';
import CollectionRemoveMutation from './Collection/CollectionRemoveMutation';
import CollectionRemoveRecordMutation from './Collection/CollectionRemoveRecordMutation';
import CollectionUpdateMutation from './Collection/CollectionUpdateMutation';
import CollectionUpdateRecordMutation from './Collection/CollectionUpdateRecordMutation';
import SegmentAddElementMutation from './Segment/SegmentAddElementMutation';
import SegmentAddMutation from './Segment/SegmentAddMutation';
import SegmentAddTemplateMutation from './Segment/SegmentAddTemplateMutation';
import SegmentCloneElementMutation from './Segment/SegmentCloneElementMutation';
import SegmentMoveElementMutation from './Segment/SegmentMoveElementMutation';
import SegmentPublishMutation from './Segment/SegmentPublishMutation';
import SegmentRemoveElementMutation from './Segment/SegmentRemoveElementMutation';
import SegmentRemoveMutation from './Segment/SegmentRemoveMutation';
import SegmentStyleAddSelectorMutation from './Segment/SegmentStyleAddSelectorMutation';
import SegmentStyleAddVariableMutation from './Segment/SegmentStyleAddVariableMutation';
import SegmentStyleRemoveSelectorMutation from './Segment/SegmentStyleRemoveSelectorMutation';
import SegmentStyleRemoveVariableMutation from './Segment/SegmentStyleRemoveVariableMutation';
import SegmentStyleUpdateSelectorMutation from './Segment/SegmentStyleUpdateSelectorMutation';
import SegmentStyleUpdateVariableMutation from './Segment/SegmentStyleUpdateVariableMutation';
import SegmentUpdateElementMutation from './Segment/SegmentUpdateElementMutation';
import SegmentUpdateMutation from './Segment/SegmentUpdateMutation';
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
import StyleAddSelectorMutation from './Style/StyleAddSelectorMutation';
import StyleAddVariableMutation from './Style/StyleAddVariableMutation';
import StyleRemoveSelectorMutation from './Style/StyleRemoveSelectorMutation';
import StyleRemoveVariableMutation from './Style/StyleRemoveVariableMutation';
import StyleUpdateMutation from './Style/StyleUpdateMutation';
import StyleUpdateSelectorMutation from './Style/StyleUpdateSelectorMutation';
import StyleUpdateVariableMutation from './Style/StyleUpdateVariableMutation';

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

export type MutationsMap = {
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
  StyleAddVariable: unknown;
  StyleUpdateVariable: unknown;
  StyleRemoveVariable: unknown;
  StyleUpdate: unknown;

  SegmentAdd: TSegmentAddMutation;
  SegmentUpdate: TSegmentUpdateMutation;
  SegmentRemove: unknown;
  SegmentAddElement: unknown;
  SegmentUpdateElement: unknown;
  SegmentRemoveElement: unknown;
  SegmentMoveElement: unknown;
  SegmentCloneElement: unknown;
  SegmentAddTemplate: unknown;
  SegmentStyleAddSelector: unknown;
  SegmentStyleUpdateSelector: unknown;
  SegmentStyleRemoveSelector: unknown;
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

const Mutations = {
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
  StyleAddVariable: StyleAddVariableMutation,
  StyleUpdateVariable: StyleUpdateVariableMutation,
  StyleRemoveVariable: StyleRemoveVariableMutation,
  StyleUpdate: StyleUpdateMutation,

  SegmentAdd: SegmentAddMutation,
  SegmentUpdate: SegmentUpdateMutation,
  SegmentRemove: SegmentRemoveMutation,
  SegmentAddElement: SegmentAddElementMutation,
  SegmentUpdateElement: SegmentUpdateElementMutation,
  SegmentRemoveElement: SegmentRemoveElementMutation,
  SegmentMoveElement: SegmentMoveElementMutation,
  SegmentCloneElement: SegmentCloneElementMutation,
  SegmentAddTemplate: SegmentAddTemplateMutation,
  SegmentStyleAddSelector: SegmentStyleAddSelectorMutation,
  SegmentStyleUpdateSelector: SegmentStyleUpdateSelectorMutation,
  SegmentStyleRemoveSelector: SegmentStyleRemoveSelectorMutation,
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

export default Mutations;
