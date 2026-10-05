import type { DataProblem, DataRefusal } from '../../../../../../types';

/** As GraphQL carries it: one shape with every field, `ok` saying which of them mean something. */
export type TSpaceSaveDataMutation = {
  ok: boolean;
  version: string | null;
  problems: DataProblem[];
  refusal: DataRefusal | null;
};

const SpaceSaveDataMutation = /* GraphQL */ `
  mutation SpaceSaveDataMutation($files: Json!, $base: String) {
    SpaceSaveData(files: $files, base: $base) {
      ok
      version
      problems {
        file
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

export default SpaceSaveDataMutation;
