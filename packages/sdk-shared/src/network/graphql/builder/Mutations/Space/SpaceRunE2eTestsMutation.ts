/** One step of an e2e test as it went. */
export type TSpaceE2eStepResult = {
  said: string;
  ok: boolean;
  read?: string;
  notRun?: true;
  ms: number;
  /** The page once the step was played, as a picture (a data URL): the run replayed step by step. */
  frame?: string;
};

/** One e2e test as it went on the draft: its steps, or why it could not start. */
export type TSpaceE2eResult = {
  id: string;
  title: string;
  ok: boolean;
  ms: number;
  steps: TSpaceE2eStepResult[];
  problem?: string;
};

/** The e2e tests played on the draft — or why none was run on this server. */
export type TSpaceRunE2eTestsMutation = { results: TSpaceE2eResult[]; notRun: string | null };

const SpaceRunE2eTestsMutation = /* GraphQL */ `
  mutation SpaceRunE2eTestsMutation($ids: [String!]) {
    SpaceRunE2eTests(ids: $ids) {
      results
      notRun
    }
  }
`;

export default SpaceRunE2eTestsMutation;
