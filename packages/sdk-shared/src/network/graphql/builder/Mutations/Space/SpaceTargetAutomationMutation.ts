export type TSpaceTargetAutomationMutation = { protected?: boolean; hook?: { url: string } | { removed: boolean } };

/** A target protected, and its deploy hook made — its address answered this once — or removed (RFC 0034 §8). */
const SpaceTargetAutomationMutation = /* GraphQL */ `
  mutation SpaceTargetAutomationMutation($domain: String!, $protected: Boolean, $hook: String) {
    SpaceTargetAutomation(domain: $domain, protected: $protected, hook: $hook)
  }
`;

export default SpaceTargetAutomationMutation;
