import type { ActionTaskDescriptor } from '../../../../../types';

export type TSpaceActionTasksQuery = {
  SpaceActionTasks: ActionTaskDescriptor[];
};

const SpaceActionTasksQuery = /* GraphQL */ `
  query SpaceActionTasksQuery {
    SpaceActionTasks {
      name
      namespace
      action
      title
      description
      origin
      params
    }
  }
`;

export default SpaceActionTasksQuery;
