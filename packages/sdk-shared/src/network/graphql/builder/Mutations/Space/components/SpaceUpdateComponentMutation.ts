/** Whether the declaration was changed. */
export type TSpaceUpdateComponentMutation = boolean;

const SpaceUpdateComponentMutation = /* GraphQL */ `
  mutation SpaceUpdateComponentMutation($environment: String!, $componentId: String!, $declaration: Json!) {
    SpaceUpdateComponent(environment: $environment, componentId: $componentId, declaration: $declaration)
  }
`;

export default SpaceUpdateComponentMutation;
