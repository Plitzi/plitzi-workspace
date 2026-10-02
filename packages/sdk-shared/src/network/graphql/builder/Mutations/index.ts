import SpaceAddActionMutation from './Space/actions/SpaceAddActionMutation';
import SpaceRemoveActionMutation from './Space/actions/SpaceRemoveActionMutation';
import SpaceRunActionMutation from './Space/actions/SpaceRunActionMutation';
import SpaceUpdateActionMutation from './Space/actions/SpaceUpdateActionMutation';
import SpaceAddCdnBucketMutation from './Space/cdns/SpaceAddCdnBucketMutation';
import SpaceAddCdnMutation from './Space/cdns/SpaceAddCdnMutation';
import SpaceRemoveCdnBucketMutation from './Space/cdns/SpaceRemoveCdnBucketMutation';
import SpaceRemoveCdnMutation from './Space/cdns/SpaceRemoveCdnMutation';
import SpaceSetCdnCredentialMutation from './Space/cdns/SpaceSetCdnCredentialMutation';
import SpaceUpdateCdnBucketMutation from './Space/cdns/SpaceUpdateCdnBucketMutation';
import SpaceUpdateCdnMutation from './Space/cdns/SpaceUpdateCdnMutation';
import SpaceAddComponentMutation from './Space/components/SpaceAddComponentMutation';
import SpaceDetachInstanceMutation from './Space/components/SpaceDetachInstanceMutation';
import SpaceRemoveComponentMutation from './Space/components/SpaceRemoveComponentMutation';
import SpaceUpdateComponentMutation from './Space/components/SpaceUpdateComponentMutation';
import SpaceAddConnectorMutation from './Space/connectors/SpaceAddConnectorMutation';
import SpaceRemoveConnectorMutation from './Space/connectors/SpaceRemoveConnectorMutation';
import SpaceUpdateConnectorMutation from './Space/connectors/SpaceUpdateConnectorMutation';
import SpaceAddCredentialMutation from './Space/credentials/SpaceAddCredentialMutation';
import SpaceRemoveCredentialMutation from './Space/credentials/SpaceRemoveCredentialMutation';
import SpaceUpdateCredentialMutation from './Space/credentials/SpaceUpdateCredentialMutation';
import SpacePublishFlagsMutation from './Space/flags/SpacePublishFlagsMutation';
import SpaceRemoveFlagMutation from './Space/flags/SpaceRemoveFlagMutation';
import SpaceSetFlagMutation from './Space/flags/SpaceSetFlagMutation';
import SpaceAddPageFolderMutation from './Space/folders/SpaceAddPageFolderMutation';
import SpaceRemovePageFolderMutation from './Space/folders/SpaceRemovePageFolderMutation';
import SpaceUpdatePageFolderMutation from './Space/folders/SpaceUpdatePageFolderMutation';
import SpaceInstallTemplateFunctionsMutation from './Space/functions/SpaceInstallTemplateFunctionsMutation';
import SpaceRemoveFunctionsMutation from './Space/functions/SpaceRemoveFunctionsMutation';
import SpaceSaveFunctionsMutation from './Space/functions/SpaceSaveFunctionsMutation';
import SpaceTryFunctionMutation from './Space/functions/SpaceTryFunctionMutation';
import SpaceAddPageMutation from './Space/pages/SpaceAddPageMutation';
import SpaceHomePageMutation from './Space/pages/SpaceHomePageMutation';
import SpaceRemovePageMutation from './Space/pages/SpaceRemovePageMutation';
import SpaceUpdatePageMutation from './Space/pages/SpaceUpdatePageMutation';
import SpaceAddResourceMutation from './Space/resources/SpaceAddResourceMutation';
import SpaceMoveResourceMutation from './Space/resources/SpaceMoveResourceMutation';
import SpaceRemoveResourceMutation from './Space/resources/SpaceRemoveResourceMutation';
import SpaceRemoveRuntimeMutation from './Space/runtime/SpaceRemoveRuntimeMutation';
import SpaceRemoveRuntimeVariableMutation from './Space/runtime/SpaceRemoveRuntimeVariableMutation';
import SpaceSetRuntimeSizeMutation from './Space/runtime/SpaceSetRuntimeSizeMutation';
import SpaceSetRuntimeVariableMutation from './Space/runtime/SpaceSetRuntimeVariableMutation';
import SpaceStartRuntimeMutation from './Space/runtime/SpaceStartRuntimeMutation';
import SpaceStopRuntimeMutation from './Space/runtime/SpaceStopRuntimeMutation';
import SpaceAddElementMutation from './Space/SpaceAddElementMutation';
import SpaceAddPluginMutation from './Space/SpaceAddPluginMutation';
import SpaceAddTemplateMutation from './Space/SpaceAddTemplateMutation';
import SpaceCloneElementMutation from './Space/SpaceCloneElementMutation';
import SpaceDeployMutation from './Space/SpaceDeployMutation';
import SpaceFixIssuesMutation from './Space/SpaceFixIssuesMutation';
import SpaceMoveElementMutation from './Space/SpaceMoveElementMutation';
import SpacePublishMutation from './Space/SpacePublishMutation';
import SpaceRemoveElementMutation from './Space/SpaceRemoveElementMutation';
import SpaceRemovePluginMutation from './Space/SpaceRemovePluginMutation';
import SpaceRenameElementMutation from './Space/SpaceRenameElementMutation';
import SpaceUpdateElementMutation from './Space/SpaceUpdateElementMutation';
import SpaceUpdateElementsMutation from './Space/SpaceUpdateElementsMutation';
import SpaceUpdateMutation from './Space/SpaceUpdateMutation';
import SpaceUpdatePluginMutation from './Space/SpaceUpdatePluginMutation';
import SpaceUpdateSchemaMutation from './Space/SpaceUpdateSchemaMutation';
import SpaceUpdateSettingsMutation from './Space/SpaceUpdateSettingsMutation';
import SpaceAddVariableMutation from './Space/variables/SpaceAddVariableMutation';
import SpaceRemoveVariableMutation from './Space/variables/SpaceRemoveVariableMutation';
import SpaceUpdateVariableMutation from './Space/variables/SpaceUpdateVariableMutation';
import SpaceAddVisitorMutation from './Space/visitors/SpaceAddVisitorMutation';
import SpaceRemoveVisitorMutation from './Space/visitors/SpaceRemoveVisitorMutation';
import StyleAddFontMutation from './Style/fonts/StyleAddFontMutation';
import StyleRemoveFontMutation from './Style/fonts/StyleRemoveFontMutation';
import StyleUpdateFontMutation from './Style/fonts/StyleUpdateFontMutation';
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

import type { TSpaceAddActionMutation } from './Space/actions/SpaceAddActionMutation';
import type { TSpaceRemoveActionMutation } from './Space/actions/SpaceRemoveActionMutation';
import type { TSpaceRunActionMutation } from './Space/actions/SpaceRunActionMutation';
import type { TSpaceUpdateActionMutation } from './Space/actions/SpaceUpdateActionMutation';
import type { TSpaceAddCdnBucketMutation } from './Space/cdns/SpaceAddCdnBucketMutation';
import type { TSpaceAddCdnMutation } from './Space/cdns/SpaceAddCdnMutation';
import type { TSpaceRemoveCdnBucketMutation } from './Space/cdns/SpaceRemoveCdnBucketMutation';
import type { TSpaceRemoveCdnMutation } from './Space/cdns/SpaceRemoveCdnMutation';
import type { TSpaceSetCdnCredentialMutation } from './Space/cdns/SpaceSetCdnCredentialMutation';
import type { TSpaceUpdateCdnBucketMutation } from './Space/cdns/SpaceUpdateCdnBucketMutation';
import type { TSpaceUpdateCdnMutation } from './Space/cdns/SpaceUpdateCdnMutation';
import type { TSpaceAddComponentMutation } from './Space/components/SpaceAddComponentMutation';
import type { TSpaceDetachInstanceMutation } from './Space/components/SpaceDetachInstanceMutation';
import type { TSpaceRemoveComponentMutation } from './Space/components/SpaceRemoveComponentMutation';
import type { TSpaceUpdateComponentMutation } from './Space/components/SpaceUpdateComponentMutation';
import type { TSpaceAddConnectorMutation } from './Space/connectors/SpaceAddConnectorMutation';
import type { TSpaceRemoveConnectorMutation } from './Space/connectors/SpaceRemoveConnectorMutation';
import type { TSpaceUpdateConnectorMutation } from './Space/connectors/SpaceUpdateConnectorMutation';
import type { TSpacePublishFlagsMutation } from './Space/flags/SpacePublishFlagsMutation';
import type { TSpaceAddPageFolderMutation } from './Space/folders/SpaceAddPageFolderMutation';
import type { TSpaceRemovePageFolderMutation } from './Space/folders/SpaceRemovePageFolderMutation';
import type { TSpaceUpdatePageFolderMutation } from './Space/folders/SpaceUpdatePageFolderMutation';
import type { TSpaceInstallTemplateFunctionsMutation } from './Space/functions/SpaceInstallTemplateFunctionsMutation';
import type { TSpaceRemoveFunctionsMutation } from './Space/functions/SpaceRemoveFunctionsMutation';
import type { TSpaceSaveFunctionsMutation } from './Space/functions/SpaceSaveFunctionsMutation';
import type { TSpaceTryFunctionMutation } from './Space/functions/SpaceTryFunctionMutation';
import type { TSpaceAddPageMutation } from './Space/pages/SpaceAddPageMutation';
import type { TSpaceHomePageMutation } from './Space/pages/SpaceHomePageMutation';
import type { TSpaceRemovePageMutation } from './Space/pages/SpaceRemovePageMutation';
import type { TSpaceUpdatePageMutation } from './Space/pages/SpaceUpdatePageMutation';
import type { TSpaceAddResourceMutation } from './Space/resources/SpaceAddResourceMutation';
import type { TSpaceMoveResourceMutation } from './Space/resources/SpaceMoveResourceMutation';
import type { TSpaceRemoveResourceMutation } from './Space/resources/SpaceRemoveResourceMutation';
import type { TSpaceAddPluginMutation } from './Space/SpaceAddPluginMutation';
import type { TSpaceDeployMutation } from './Space/SpaceDeployMutation';
import type { TSpaceFixIssuesMutation } from './Space/SpaceFixIssuesMutation';
import type { TSpacePublishMutation } from './Space/SpacePublishMutation';
import type { TSpaceRenameElementMutation } from './Space/SpaceRenameElementMutation';
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
  SpaceSetFlag: unknown;
  SpaceRemoveFlag: unknown;
  SpaceAddElement: unknown;
  SpaceUpdateElement: unknown;
  SpaceRenameElement: TSpaceRenameElementMutation;
  SpaceUpdateElements: unknown;
  SpaceRemoveElement: unknown;
  SpaceMoveElement: unknown;
  SpaceCloneElement: unknown;
  SpaceAddComponent: TSpaceAddComponentMutation;
  SpaceUpdateComponent: TSpaceUpdateComponentMutation;
  SpaceRemoveComponent: TSpaceRemoveComponentMutation;
  SpaceDetachInstance: TSpaceDetachInstanceMutation;
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
  SpaceAddCdnBucket: TSpaceAddCdnBucketMutation;
  SpaceUpdateCdnBucket: TSpaceUpdateCdnBucketMutation;
  SpaceRemoveCdnBucket: TSpaceRemoveCdnBucketMutation;
  SpaceAddAction: TSpaceAddActionMutation;
  SpaceUpdateAction: TSpaceUpdateActionMutation;
  SpaceRemoveAction: TSpaceRemoveActionMutation;
  SpaceRunAction: TSpaceRunActionMutation;
  SpaceSaveFunctions: TSpaceSaveFunctionsMutation;
  SpaceRemoveFunctions: TSpaceRemoveFunctionsMutation;
  SpaceInstallTemplateFunctions: TSpaceInstallTemplateFunctionsMutation;
  SpaceTryFunction: TSpaceTryFunctionMutation;
  SpaceAddConnector: TSpaceAddConnectorMutation;
  SpaceUpdateConnector: TSpaceUpdateConnectorMutation;
  SpaceRemoveConnector: TSpaceRemoveConnectorMutation;
  SpaceAddCredential: unknown;
  SpaceUpdateCredential: unknown;
  SpaceRemoveCredential: unknown;
  SpaceAddVisitor: unknown;
  SpaceRemoveVisitor: unknown;
  SpaceSetRuntimeVariable: string[];
  SpaceSetRuntimeSize: boolean;
  SpaceStartRuntime: boolean;
  SpaceStopRuntime: boolean;
  SpaceRemoveRuntimeVariable: string[];
  SpaceRemoveRuntime: boolean;
  SpacePublish: TSpacePublishMutation;
  SpacePublishFlags: TSpacePublishFlagsMutation;
  SpaceFixIssues: TSpaceFixIssuesMutation;
  SpaceDeploy: TSpaceDeployMutation;
  SpaceUpdateSettings: unknown;

  StyleAddSelector: unknown;
  StyleUpdateSelector: unknown;
  StyleRemoveSelector: unknown;
  StyleRemoveSelectors: unknown;
  StyleAddSelectorVariable: unknown;
  StyleUpdateSelectorVariable: unknown;
  StyleRemoveSelectorVariable: unknown;
  StyleAddFont: unknown;
  StyleUpdateFont: unknown;
  StyleRemoveFont: unknown;
  StyleAddVariable: unknown;
  StyleUpdateVariable: unknown;
  StyleRemoveVariable: unknown;
  StyleUpdate: unknown;
  StyleUpdateSettings: unknown;
};

const BuilderMutations: Record<keyof BuilderMutationsMap, string> = {
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
  SpaceSetFlag: SpaceSetFlagMutation,
  SpaceRemoveFlag: SpaceRemoveFlagMutation,
  SpaceAddElement: SpaceAddElementMutation,
  SpaceUpdateElement: SpaceUpdateElementMutation,
  SpaceRenameElement: SpaceRenameElementMutation,
  SpaceUpdateElements: SpaceUpdateElementsMutation,
  SpaceRemoveElement: SpaceRemoveElementMutation,
  SpaceMoveElement: SpaceMoveElementMutation,
  SpaceCloneElement: SpaceCloneElementMutation,
  SpaceAddComponent: SpaceAddComponentMutation,
  SpaceUpdateComponent: SpaceUpdateComponentMutation,
  SpaceRemoveComponent: SpaceRemoveComponentMutation,
  SpaceDetachInstance: SpaceDetachInstanceMutation,
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
  SpaceAddCdnBucket: SpaceAddCdnBucketMutation,
  SpaceUpdateCdnBucket: SpaceUpdateCdnBucketMutation,
  SpaceRemoveCdnBucket: SpaceRemoveCdnBucketMutation,
  SpaceAddAction: SpaceAddActionMutation,
  SpaceUpdateAction: SpaceUpdateActionMutation,
  SpaceRemoveAction: SpaceRemoveActionMutation,
  SpaceRunAction: SpaceRunActionMutation,
  SpaceSaveFunctions: SpaceSaveFunctionsMutation,
  SpaceRemoveFunctions: SpaceRemoveFunctionsMutation,
  SpaceInstallTemplateFunctions: SpaceInstallTemplateFunctionsMutation,
  SpaceTryFunction: SpaceTryFunctionMutation,
  SpaceAddConnector: SpaceAddConnectorMutation,
  SpaceUpdateConnector: SpaceUpdateConnectorMutation,
  SpaceRemoveConnector: SpaceRemoveConnectorMutation,
  SpaceAddCredential: SpaceAddCredentialMutation,
  SpaceUpdateCredential: SpaceUpdateCredentialMutation,
  SpaceRemoveCredential: SpaceRemoveCredentialMutation,
  SpaceAddVisitor: SpaceAddVisitorMutation,
  SpaceRemoveVisitor: SpaceRemoveVisitorMutation,
  SpaceSetRuntimeVariable: SpaceSetRuntimeVariableMutation,
  SpaceSetRuntimeSize: SpaceSetRuntimeSizeMutation,
  SpaceStartRuntime: SpaceStartRuntimeMutation,
  SpaceStopRuntime: SpaceStopRuntimeMutation,
  SpaceRemoveRuntimeVariable: SpaceRemoveRuntimeVariableMutation,
  SpaceRemoveRuntime: SpaceRemoveRuntimeMutation,
  SpacePublish: SpacePublishMutation,
  SpacePublishFlags: SpacePublishFlagsMutation,
  SpaceFixIssues: SpaceFixIssuesMutation,
  SpaceDeploy: SpaceDeployMutation,
  SpaceUpdateSettings: SpaceUpdateSettingsMutation,

  StyleAddSelector: StyleAddSelectorMutation,
  StyleUpdateSelector: StyleUpdateSelectorMutation,
  StyleRemoveSelector: StyleRemoveSelectorMutation,
  StyleRemoveSelectors: StyleRemoveSelectorsMutation,
  StyleAddSelectorVariable: StyleAddSelectorVariableMutation,
  StyleUpdateSelectorVariable: StyleUpdateSelectorVariableMutation,
  StyleRemoveSelectorVariable: StyleRemoveSelectorVariableMutation,
  StyleAddFont: StyleAddFontMutation,
  StyleUpdateFont: StyleUpdateFontMutation,
  StyleRemoveFont: StyleRemoveFontMutation,
  StyleAddVariable: StyleAddVariableMutation,
  StyleUpdateVariable: StyleUpdateVariableMutation,
  StyleRemoveVariable: StyleRemoveVariableMutation,
  StyleUpdate: StyleUpdateMutation,
  StyleUpdateSettings: StyleUpdateSettingsMutation
};

export default BuilderMutations;
