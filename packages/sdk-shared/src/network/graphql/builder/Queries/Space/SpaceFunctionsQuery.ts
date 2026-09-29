import type { FunctionsDraft } from '../../../../../types';

export type TSpaceFunctionsQuery = {
  SpaceFunctions: FunctionsDraft;
};

const SpaceFunctionsQuery = /* GraphQL */ `
  query SpaceFunctionsQuery {
    SpaceFunctions {
      files
      version
      manifest
      offer {
        template
      }
    }
  }
`;

export default SpaceFunctionsQuery;
