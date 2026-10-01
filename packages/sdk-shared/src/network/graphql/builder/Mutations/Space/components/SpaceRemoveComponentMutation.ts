/** Whether the component was removed. */
export type TSpaceRemoveComponentMutation = boolean;

const SpaceRemoveComponentMutation = /* GraphQL */ `
  mutation SpaceRemoveComponentMutation($environment: String!, $componentId: String!) {
    SpaceRemoveComponent(environment: $environment, componentId: $componentId)
  }
`;

export default SpaceRemoveComponentMutation;
