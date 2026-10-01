/** The id of the copy that replaced the instance. */
export type TSpaceDetachInstanceMutation = string;

const SpaceDetachInstanceMutation = /* GraphQL */ `
  mutation SpaceDetachInstanceMutation($environment: String!, $instanceId: String!) {
    SpaceDetachInstance(environment: $environment, instanceId: $instanceId)
  }
`;

export default SpaceDetachInstanceMutation;
