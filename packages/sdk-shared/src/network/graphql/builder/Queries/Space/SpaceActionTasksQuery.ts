import { gql } from '@apollo/client/core';

import type { ActionTaskDescriptor } from '../../../../../types';

export type TSpaceActionTasksQuery = {
  SpaceActionTasks: ActionTaskDescriptor[];
};

const SpaceActionTasksQuery = gql`
  query SpaceActionTasksQuery {
    SpaceActionTasks {
      name
      namespace
      action
      title
      description
      params
    }
  }
`;

export default SpaceActionTasksQuery;
