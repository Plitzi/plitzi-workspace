export type TSpaceCancelScheduledPublishMutation = { canceled: boolean };

/** A publish set for later, called off before it runs. */
const SpaceCancelScheduledPublishMutation = /* GraphQL */ `
  mutation SpaceCancelScheduledPublishMutation($id: Int!) {
    SpaceCancelScheduledPublish(id: $id)
  }
`;

export default SpaceCancelScheduledPublishMutation;
