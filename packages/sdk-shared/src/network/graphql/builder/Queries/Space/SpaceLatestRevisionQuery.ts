export type TSpaceLatestRevisionQuery = {
  SpaceLatestRevision: { snapshot: { revision: number; publishedAt: Date; description: string } | null } | null;
};

const SpaceLatestRevisionQuery = /* GraphQL */ `
  query SpaceLatestRevisionQuery($environment: String!) {
    SpaceLatestRevision(environment: $environment) {
      snapshot {
        description
        revision
        publishedAt
      }
    }
  }
`;

export default SpaceLatestRevisionQuery;
