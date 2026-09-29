import { gql } from 'graphql-tag';

import type { FunctionsDraft } from '../../../../../types';

export type TSpaceFunctionsQuery = {
  SpaceFunctions: FunctionsDraft;
};

const SpaceFunctionsQuery = gql`
  query SpaceFunctionsQuery {
    SpaceFunctions {
      files
      version
      manifest
    }
  }
`;

export default SpaceFunctionsQuery;
