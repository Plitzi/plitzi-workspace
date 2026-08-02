import type { Schema } from './SchemaTypes';
import type { Style } from './StyleTypes';

export type Template = {
  id?: string;
  definition: {
    name: string;
    description: string;
    baseElementId: Element['id'];
  };
  schema: Schema;
  style: Style;
};

export type SubscriptionCollaboratorElement = { elementId: string; rootId: string };

// Where a collaborator's cursor currently is, in canvas coordinates, mirrored into the store for the devtools
// ONLY. The cursor itself is drawn imperatively — a pointer must never take the render path — so nothing but an
// inspector reads this, and nothing writes it unless debug mode is on.
export type SubscriptionCollaboratorPointer = { rootId: string; anchorId?: string; x: number; y: number };

export type SubscriptionCollaboratorElementState = {
  hovered?: SubscriptionCollaboratorElement;
  selected?: SubscriptionCollaboratorElement;
};

export type SubscriptionCollaborator = {
  color: string;
  user: { firstName: string; surName: string };
  instanceId: string;
  // What this collaborator has hovered/selected right now, kept with the connection so someone joining (or
  // reloading) later still sees it — the live event only ever reaches whoever was already connected.
  elementState?: SubscriptionCollaboratorElementState;
};
