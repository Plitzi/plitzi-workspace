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
  /**
   * Present when the collaborator is an agent writing over the MCP — `user.firstName` is then the application
   * (`Claude`) and `for` the member it acts for. It has no cursor: what it changed last is what it has selected, and it
   * leaves once it has written nothing for a while.
   */
  agent?: { for: string };
};
