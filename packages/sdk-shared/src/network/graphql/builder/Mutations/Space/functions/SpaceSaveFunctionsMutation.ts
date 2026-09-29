import { gql } from '@apollo/client/core';

import type { FunctionsManifest, FunctionsProblem, FunctionsRefusal } from '../../../../../../types';

/** As GraphQL carries it: one shape with every field, `ok` saying which of them mean something. */
export type TSpaceSaveFunctionsMutation = {
  ok: boolean;
  version: string | null;
  manifest: FunctionsManifest | null;
  problems: FunctionsProblem[];
  refusal: FunctionsRefusal | null;
};

const SpaceSaveFunctionsMutation = gql`
  mutation SpaceSaveFunctionsMutation($files: Json!, $base: String) {
    SpaceSaveFunctions(files: $files, base: $base) {
      ok
      version
      manifest
      problems {
        file
        line
        column
        message
      }
      refusal {
        status
        error
        limit
      }
    }
  }
`;

export default SpaceSaveFunctionsMutation;
