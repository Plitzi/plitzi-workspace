import { gql } from '@apollo/client/core';

export type TSegmentRemoveElementSubscription = {
  contextId: string;
  elementId: string;
};

const SegmentRemoveElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentRemoveElement(environment: $environment) {
      contextId
      elementId
    }
  }
`;

export default SegmentRemoveElementSubscription;
