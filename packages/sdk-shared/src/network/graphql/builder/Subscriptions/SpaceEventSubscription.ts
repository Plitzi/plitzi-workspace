import { gql } from '@apollo/client/core';

import type { SpaceEventName } from '../../../spaceEvents';

/**
 * The single live channel of a space. Every edit — elements, pages, variables, styles, segments — arrives on this
 * one subscription and is told apart by `event`, instead of one operation (and one Redis channel, and one websocket
 * subscription) per kind of edit.
 *
 * `data` is JSON on the wire: no selection set can describe an element, a page, a style selector and a variable at
 * once. What gives it a shape again is `SpaceEventMap` in `network/spaceEvents` — the same module the server reads
 * the event names from, so publisher and consumer cannot drift.
 */
const SpaceEventSubscription = gql`
  subscription ($environment: String!) {
    SpaceEvent(environment: $environment) {
      event
      data
    }
  }
`;

/** What the subscription itself yields: the event name, and its payload still to be narrowed by `SpaceEventMap`. */
export type TSpaceEventSubscription = { SpaceEvent: { event: SpaceEventName; data: unknown } };

export default SpaceEventSubscription;
