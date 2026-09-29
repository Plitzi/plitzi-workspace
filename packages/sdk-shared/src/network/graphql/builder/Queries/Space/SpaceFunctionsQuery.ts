import { gql } from '@apollo/client/core';

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
