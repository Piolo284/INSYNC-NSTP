import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '../api/client';

/**
 * Small data-fetching hook shared by every page: tracks loading/error/data,
 * exposes refetch(), and ignores results from a stale in-flight call (e.g.
 * user changes filters before the first request lands).
 *
 * `fetcher` should be a stable-enough function (wrap in useCallback in the
 * caller); it re-runs whenever `deps` changes.
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (id === requestId.current) {
        setData(result);
        setLoading(false);
      }
    } catch (err) {
      if (id === requestId.current) {
        setError(err instanceof ApiClientError ? err.message : 'Unable to load data.');
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}

export function errorMessage(err, fallback = 'Something went wrong.') {
  if (err instanceof ApiClientError) return err.message;
  if (err && err.message) return err.message;
  return fallback;
}
