import { gql } from 'graphql-tag';

import type { ActionCheckReport } from '../../../../../types';

export type TSpaceCheckActionQuery = {
  SpaceCheckAction: ActionCheckReport;
};

const SpaceCheckActionQuery = gql`
  query SpaceCheckActionQuery($identifier: String!) {
    SpaceCheckAction(identifier: $identifier) {
      valid
      issues {
        level
        path
        message
        hint
      }
    }
  }
`;

export default SpaceCheckActionQuery;
