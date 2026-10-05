import type { DataDraft } from '../../../../../types';

export type TSpaceDataQuery = {
  SpaceData: DataDraft;
};

const SpaceDataQuery = /* GraphQL */ `
  query SpaceDataQuery {
    SpaceData {
      files
      version
    }
  }
`;

export default SpaceDataQuery;
