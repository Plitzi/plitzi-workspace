import { useCallback, useState } from 'react';

const useAiErrors = () => {
  const [error, setError] = useState<string | undefined>();
  const [quotaError, setQuotaError] = useState<string | undefined>();
  const [quotaRetryAfter, setQuotaRetryAfter] = useState<number | undefined>();

  const clearError = useCallback(() => setError(undefined), []);

  const clearQuotaError = useCallback(() => {
    setQuotaError(undefined);
    setQuotaRetryAfter(undefined);
  }, []);

  const clearAll = useCallback(() => {
    setError(undefined);
    setQuotaError(undefined);
    setQuotaRetryAfter(undefined);
  }, []);

  const setQuotaLimitError = useCallback((message: string, retryAfter: number) => {
    setQuotaError(message);
    setQuotaRetryAfter(retryAfter);
  }, []);

  return {
    error,
    setError,
    quotaError,
    quotaRetryAfter,
    clearError,
    clearQuotaError,
    clearAll,
    setQuotaLimitError
  };
};

export default useAiErrors;
