// Collaborator subscriptions
import CollaboratorConnectedSubscription from './Collaborator/CollaboratorConnectedSubscription';
import CollaboratorDisconnectedSubscription from './Collaborator/CollaboratorDisconnectedSubscription';
// Segment subscriptions
import SegmentAddTemplateSubscription from './Segment/SegmentAddTemplateSubscription';
import SegmentAddElementSubscription from './Segment/space/elements/SegmentAddElementSubscription';
import SegmentCloneElementSubscription from './Segment/space/elements/SegmentCloneElementSubscription';
import SegmentMoveElementSubscription from './Segment/space/elements/SegmentMoveElementSubscription';
import SegmentRemoveElementSubscription from './Segment/space/elements/SegmentRemoveElementSubscription';
import SegmentUpdateElementSubscription from './Segment/space/elements/SegmentUpdateElementSubscription';
import SegmentStyleAddSelectorSubscription from './Segment/style/selectors/SegmentStyleAddSelectorSubscription';
import SegmentStyleRemoveSelectorSubscription from './Segment/style/selectors/SegmentStyleRemoveSelectorSubscription';
import SegmentStyleUpdateSelectorSubscription from './Segment/style/selectors/SegmentStyleUpdateSelectorSubscription';
import SegmentStyleAddSelectorVariableSubscription from './Segment/style/selectorVariables/SegmentStyleAddSelectorVariableSubscription';
import SegmentStyleRemoveSelectorVariableSubscription from './Segment/style/selectorVariables/SegmentStyleRemoveSelectorVariableSubscription';
import SegmentStyleUpdateSelectorVariableSubscription from './Segment/style/selectorVariables/SegmentStyleUpdateSelectorVariableSubscription';
import SegmentStyleAddVariableSubscription from './Segment/style/variables/SegmentStyleAddVariableSubscription';
import SegmentStyleRemoveVariableSubscription from './Segment/style/variables/SegmentStyleRemoveVariableSubscription';
import SegmentStyleUpdateVariableSubscription from './Segment/style/variables/SegmentStyleUpdateVariableSubscription';
// Space subscriptions
import SpaceAddElementSubscription from './Space/elements/SpaceAddElementSubscription';
import SpaceCloneElementSubscription from './Space/elements/SpaceCloneElementSubscription';
import SpaceMoveElementSubscription from './Space/elements/SpaceMoveElementSubscription';
import SpaceRemoveElementSubscription from './Space/elements/SpaceRemoveElementSubscription';
import SpaceUpdateElementSubscription from './Space/elements/SpaceUpdateElementSubscription';
import SpaceAddPageFolderSubscription from './Space/folders/SpaceAddPageFolderSubscription';
import SpaceRemovePageFolderSubscription from './Space/folders/SpaceRemovePageFolderSubscription';
import SpaceUpdatePageFolderSubscription from './Space/folders/SpaceUpdatePageFolderSubscription';
import SpaceAddPageSubscription from './Space/pages/SpaceAddPageSubscription';
import SpaceHomePageSubscription from './Space/pages/SpaceHomePageSubscription';
import SpaceRemovePageSubscription from './Space/pages/SpaceRemovePageSubscription';
import SpaceUpdatePageSubscription from './Space/pages/SpaceUpdatePageSubscription';
import SpaceAddTemplateSubscription from './Space/SpaceAddTemplateSubscription';
import SpaceUpdatedSubscription from './Space/SpaceUpdatedSubscription'; // Other Space Subscriptions
import SpaceUpdateSettingsSubscription from './Space/SpaceUpdateSettingsSubscription';
import SpaceAddVariableSubscription from './Space/variables/SpaceAddVariableSubscription';
import SpaceRemoveVariableSubscription from './Space/variables/SpaceRemoveVariableSubscription';
import SpaceUpdateVariableSubscription from './Space/variables/SpaceUpdateVariableSubscription';
// Style subscriptions
import StyleAddSelectorSubscription from './Style/selector/StyleAddSelectorSubscription';
import StyleRemoveSelectorSubscription from './Style/selector/StyleRemoveSelectorSubscription';
import StyleUpdateSelectorSubscription from './Style/selector/StyleUpdateSelectorSubscription';
import StyleAddSelectorVariableSubscription from './Style/selectorVariables/StyleAddSelectorVariableSubscription';
import StyleRemoveSelectorVariableSubscription from './Style/selectorVariables/StyleRemoveSelectorVariableSubscription';
import StyleUpdateSelectorVariableSubscription from './Style/selectorVariables/StyleUpdateSelectorVariableSubscription';
import StyleUpdatedSubscription from './Style/StyleUpdatedSubscription'; // Other Style Subscriptions
import StyleUpdateSettingsSubscription from './Style/StyleUpdateSettingsSubscription';
import StyleAddVariableSubscription from './Style/variables/StyleAddVariableSubscription';
import StyleRemoveVariableSubscription from './Style/variables/StyleRemoveVariableSubscription';
import StyleUpdateVariableSubscription from './Style/variables/StyleUpdateVariableSubscription';

import type { TCollaboratorConnectedSubscription } from './Collaborator/CollaboratorConnectedSubscription';
import type { TCollaboratorDisconnectedSubscription } from './Collaborator/CollaboratorDisconnectedSubscription';
import type { TSpaceAddElementSubscription } from './Space/elements/SpaceAddElementSubscription';
import type { TSpaceCloneElementSubscription } from './Space/elements/SpaceCloneElementSubscription';
import type { TSpaceMoveElementSubscription } from './Space/elements/SpaceMoveElementSubscription';
import type { TSpaceRemoveElementSubscription } from './Space/elements/SpaceRemoveElementSubscription';
import type { TSpaceUpdateElementSubscription } from './Space/elements/SpaceUpdateElementSubscription';
import type { TSpaceAddPageFolderSubscription } from './Space/folders/SpaceAddPageFolderSubscription';
import type { TSpaceRemovePageFolderSubscription } from './Space/folders/SpaceRemovePageFolderSubscription';
import type { TSpaceUpdatePageFolderSubscription } from './Space/folders/SpaceUpdatePageFolderSubscription';
import type { TSpaceAddPageSubscription } from './Space/pages/SpaceAddPageSubscription';
import type { TSpaceHomePageSubscription } from './Space/pages/SpaceHomePageSubscription';
import type { TSpaceRemovePageSubscription } from './Space/pages/SpaceRemovePageSubscription';
import type { TSpaceUpdatePageSubscription } from './Space/pages/SpaceUpdatePageSubscription';
import type { TSpaceAddTemplateSubscription } from './Space/SpaceAddTemplateSubscription';
import type { TSpaceUpdatedSubscription } from './Space/SpaceUpdatedSubscription'; // Other Space Subscriptions
import type { TSpaceUpdateSettingsSubscription } from './Space/SpaceUpdateSettingsSubscription';
import type { TSpaceAddVariableSubscription } from './Space/variables/SpaceAddVariableSubscription';
import type { TSpaceRemoveVariableSubscription } from './Space/variables/SpaceRemoveVariableSubscription';
import type { TSpaceUpdateVariableSubscription } from './Space/variables/SpaceUpdateVariableSubscription';
import type { TStyleAddSelectorSubscription } from './Style/selector/StyleAddSelectorSubscription';
import type { TStyleRemoveSelectorSubscription } from './Style/selector/StyleRemoveSelectorSubscription';
import type { TStyleUpdateSelectorSubscription } from './Style/selector/StyleUpdateSelectorSubscription';
import type { TStyleAddSelectorVariableSubscription } from './Style/selectorVariables/StyleAddSelectorVariableSubscription';
import type { TStyleRemoveSelectorVariableSubscription } from './Style/selectorVariables/StyleRemoveSelectorVariableSubscription';
import type { TStyleUpdateSelectorVariableSubscription } from './Style/selectorVariables/StyleUpdateSelectorVariableSubscription';
import type { TStyleUpdatedSubscription } from './Style/StyleUpdatedSubscription'; // Other Style Subscriptions
import type { TStyleUpdateSettingsSubscription } from './Style/StyleUpdateSettingsSubscription';
import type { TStyleAddVariableSubscription } from './Style/variables/StyleAddVariableSubscription';
import type { TStyleRemoveVariableSubscription } from './Style/variables/StyleRemoveVariableSubscription';
import type { TStyleUpdateVariableSubscription } from './Style/variables/StyleUpdateVariableSubscription';

export type SubscriptionsMap = {
  CollaboratorConnected: TCollaboratorConnectedSubscription;
  CollaboratorDisconnected: TCollaboratorDisconnectedSubscription;
  SpaceUpdated: TSpaceUpdatedSubscription;
  StyleUpdated: TStyleUpdatedSubscription;

  SpaceAddPage: TSpaceAddPageSubscription;
  SpaceHomePage: TSpaceHomePageSubscription;
  SpaceUpdatePage: TSpaceUpdatePageSubscription;
  SpaceRemovePage: TSpaceRemovePageSubscription;
  SpaceAddPageFolder: TSpaceAddPageFolderSubscription;
  SpaceUpdatePageFolder: TSpaceUpdatePageFolderSubscription;
  SpaceRemovePageFolder: TSpaceRemovePageFolderSubscription;
  SpaceAddVariable: TSpaceAddVariableSubscription;
  SpaceUpdateVariable: TSpaceUpdateVariableSubscription;
  SpaceRemoveVariable: TSpaceRemoveVariableSubscription;
  SpaceAddElement: TSpaceAddElementSubscription;
  SpaceUpdateElement: TSpaceUpdateElementSubscription;
  SpaceRemoveElement: TSpaceRemoveElementSubscription;
  SpaceMoveElement: TSpaceMoveElementSubscription;
  SpaceCloneElement: TSpaceCloneElementSubscription;
  SpaceAddTemplate: TSpaceAddTemplateSubscription;
  SpaceUpdateSettings: TSpaceUpdateSettingsSubscription;

  StyleAddSelector: TStyleAddSelectorSubscription;
  StyleUpdateSelector: TStyleUpdateSelectorSubscription;
  StyleRemoveSelector: TStyleRemoveSelectorSubscription;
  StyleAddSelectorVariable: TStyleAddSelectorVariableSubscription;
  StyleUpdateSelectorVariable: TStyleUpdateSelectorVariableSubscription;
  StyleRemoveSelectorVariable: TStyleRemoveSelectorVariableSubscription;
  StyleAddVariable: TStyleAddVariableSubscription;
  StyleUpdateVariable: TStyleUpdateVariableSubscription;
  StyleRemoveVariable: TStyleRemoveVariableSubscription;
  StyleUpdateSettings: TStyleUpdateSettingsSubscription;

  SegmentAddElement: unknown;
  SegmentUpdateElement: unknown;
  SegmentRemoveElement: unknown;
  SegmentMoveElement: unknown;
  SegmentCloneElement: unknown;
  SegmentAddTemplate: unknown;
  SegmentStyleAddSelector: unknown;
  SegmentStyleUpdateSelector: unknown;
  SegmentStyleRemoveSelector: unknown;
  SegmentStyleAddSelectorVariable: unknown;
  SegmentStyleUpdateSelectorVariable: unknown;
  SegmentStyleRemoveSelectorVariable: unknown;
  SegmentStyleAddVariable: unknown;
  SegmentStyleUpdateVariable: unknown;
  SegmentStyleRemoveVariable: unknown;
};

const Subscriptions = {
  CollaboratorConnected: CollaboratorConnectedSubscription,
  CollaboratorDisconnected: CollaboratorDisconnectedSubscription,
  SpaceUpdated: SpaceUpdatedSubscription,
  StyleUpdated: StyleUpdatedSubscription,

  SpaceAddPage: SpaceAddPageSubscription,
  SpaceHomePage: SpaceHomePageSubscription,
  SpaceUpdatePage: SpaceUpdatePageSubscription,
  SpaceRemovePage: SpaceRemovePageSubscription,
  SpaceAddPageFolder: SpaceAddPageFolderSubscription,
  SpaceUpdatePageFolder: SpaceUpdatePageFolderSubscription,
  SpaceRemovePageFolder: SpaceRemovePageFolderSubscription,
  SpaceAddVariable: SpaceAddVariableSubscription,
  SpaceUpdateVariable: SpaceUpdateVariableSubscription,
  SpaceRemoveVariable: SpaceRemoveVariableSubscription,
  SpaceAddElement: SpaceAddElementSubscription,
  SpaceUpdateElement: SpaceUpdateElementSubscription,
  SpaceRemoveElement: SpaceRemoveElementSubscription,
  SpaceMoveElement: SpaceMoveElementSubscription,
  SpaceCloneElement: SpaceCloneElementSubscription,
  SpaceAddTemplate: SpaceAddTemplateSubscription,
  SpaceUpdateSettings: SpaceUpdateSettingsSubscription,

  StyleAddSelector: StyleAddSelectorSubscription,
  StyleUpdateSelector: StyleUpdateSelectorSubscription,
  StyleRemoveSelector: StyleRemoveSelectorSubscription,
  StyleAddSelectorVariable: StyleAddSelectorVariableSubscription,
  StyleUpdateSelectorVariable: StyleUpdateSelectorVariableSubscription,
  StyleRemoveSelectorVariable: StyleRemoveSelectorVariableSubscription,
  StyleAddVariable: StyleAddVariableSubscription,
  StyleUpdateVariable: StyleUpdateVariableSubscription,
  StyleRemoveVariable: StyleRemoveVariableSubscription,
  StyleUpdateSettings: StyleUpdateSettingsSubscription,

  SegmentAddElement: SegmentAddElementSubscription,
  SegmentUpdateElement: SegmentUpdateElementSubscription,
  SegmentRemoveElement: SegmentRemoveElementSubscription,
  SegmentMoveElement: SegmentMoveElementSubscription,
  SegmentCloneElement: SegmentCloneElementSubscription,
  SegmentAddTemplate: SegmentAddTemplateSubscription,
  SegmentStyleAddSelector: SegmentStyleAddSelectorSubscription,
  SegmentStyleUpdateSelector: SegmentStyleUpdateSelectorSubscription,
  SegmentStyleRemoveSelector: SegmentStyleRemoveSelectorSubscription,
  SegmentStyleAddSelectorVariable: SegmentStyleAddSelectorVariableSubscription,
  SegmentStyleUpdateSelectorVariable: SegmentStyleUpdateSelectorVariableSubscription,
  SegmentStyleRemoveSelectorVariable: SegmentStyleRemoveSelectorVariableSubscription,
  SegmentStyleAddVariable: SegmentStyleAddVariableSubscription,
  SegmentStyleUpdateVariable: SegmentStyleUpdateVariableSubscription,
  SegmentStyleRemoveVariable: SegmentStyleRemoveVariableSubscription
};

export default Subscriptions;
