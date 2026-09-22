export type ProviderOutcome = 'success' | 'error' | undefined;

export type ProviderOutcomeParams = {
  serverMode: boolean;
  /** Browser provider: what its request answered. */
  isSuccess: boolean;
  isError: boolean;
  /** Server provider: a payload has arrived, and it is for the page the visitor is on. */
  rscResolved: boolean;
  rscPending: boolean;
  /** Server provider: this element's slice of that payload — `null` when the server could not resolve it. */
  elementData: unknown;
};

/**
 * Which of `onApiSuccess` / `onApiError` a provider has earned, or neither yet.
 *
 * The same question for both runtimes, answered from what each one has. A browser provider has its request's
 * status. A server provider has no request of its own — its data arrives in the page's RSC payload — so success is
 * its slice being there and error is the payload arriving WITHOUT it. Asked only of the browser request, a server
 * provider never fired either trigger, and a flow its author wired to them never ran.
 *
 * A payload resolved for another page is neither: the visitor navigated and this provider's answer is still on its
 * way.
 */
const providerOutcome = ({
  serverMode,
  isSuccess,
  isError,
  rscResolved,
  rscPending,
  elementData
}: ProviderOutcomeParams): ProviderOutcome => {
  if (!serverMode) {
    if (isSuccess) {
      return 'success';
    }

    return isError ? 'error' : undefined;
  }

  if (!rscResolved || rscPending) {
    return undefined;
  }

  return elementData === null || elementData === undefined ? 'error' : 'success';
};

export default providerOutcome;
