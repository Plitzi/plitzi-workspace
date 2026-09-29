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
      params
    }
  }
`;

export default SpaceActionTasksQuery;
