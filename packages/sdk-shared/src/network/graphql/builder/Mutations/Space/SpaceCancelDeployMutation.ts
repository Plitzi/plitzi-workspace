export type TSpaceCancelDeployMutation = { canceled: boolean; message: string };

/** Stops a deploy where it is; what it uploaded stays. */
const SpaceCancelDeployMutation = /* GraphQL */ `
  mutation SpaceCancelDeployMutation($id: Int!) {
    SpaceCancelDeploy(id: $id)
  }
`;

export default SpaceCancelDeployMutation;
