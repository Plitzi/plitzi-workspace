import type { TSpaceSaveFunctionsMutation } from './SpaceSaveFunctionsMutation';

/** Installs the functions the space's template brought (`SpaceFunctions.offer`): answered as a save is. */
export type TSpaceInstallTemplateFunctionsMutation = TSpaceSaveFunctionsMutation;

const SpaceInstallTemplateFunctionsMutation = /* GraphQL */ `
  mutation SpaceInstallTemplateFunctionsMutation {
    SpaceInstallTemplateFunctions {
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

export default SpaceInstallTemplateFunctionsMutation;
