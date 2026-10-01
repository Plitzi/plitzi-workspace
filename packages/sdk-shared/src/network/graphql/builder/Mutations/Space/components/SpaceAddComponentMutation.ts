/** Whether the component was declared. */
export type TSpaceAddComponentMutation = boolean;

const SpaceAddComponentMutation = /* GraphQL */ `
  mutation SpaceAddComponentMutation($environment: String!, $component: Json!, $from: Json) {
    SpaceAddComponent(environment: $environment, component: $component, from: $from)
  }
`;

export default SpaceAddComponentMutation;
