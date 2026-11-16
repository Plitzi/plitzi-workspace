import type { SpaceDeployDetail } from '../../../../../types';

export type TSpaceDeployDetailQuery = { SpaceDeployDetail: SpaceDeployDetail };

/** One deploy with its log, read while it runs. */
const SpaceDeployDetailQuery = /* GraphQL */ `
  query SpaceDeployDetailQuery($id: Int!) {
    SpaceDeployDetail(id: $id)
  }
`;

export default SpaceDeployDetailQuery;
