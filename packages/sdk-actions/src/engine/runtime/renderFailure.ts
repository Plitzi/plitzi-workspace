import type { ActionRunSummary } from '@plitzi/sdk-shared';

/**
 * A render run that resolved nothing, carrying what it did.
 *
 * The slice is withheld all the same — `resolveRscData` reads the rejection as the element's error state — but the
 * steps travel with the error, so a page allowed to debug is still shown where the flow broke.
 */
export class RenderRunFailure extends Error {
  readonly summary: ActionRunSummary;
  /**
   * The action answered this visitor with a refusal (`ActionRefusal`): a room closed, data that is another's — the
   * action doing its job, said as a warning, never an error with its stack (a run's log, a guest's every page).
   */
  readonly refused: boolean;
  /**
   * A refusal's own words, written for whoever called: what the element shows the visitor, alone — never the log's
   * line around them ("Action … ended as failed, refused (code): …"), which a page had to split to show.
   */
  readonly said?: string;

  constructor(
    message: string,
    summary: ActionRunSummary,
    options?: ErrorOptions & { refused?: boolean; said?: string }
  ) {
    super(message, options);
    this.summary = summary;
    this.refused = options?.refused === true;
    if (options?.said !== undefined) {
      this.said = options.said;
    }
  }
}
