import { useEffect, useRef, useState } from "react";

// Tiny data-loading hook used by the screens. Keeps loading/error/data in one
// place so every screen shows an honest spinner/empty/error state instead of
// inventing content.
export type AsyncState<T> = {
  loading: boolean;
  data: T | null;
  error: string | null;
  reload: () => void;
};

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((value) => {
        if (active) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { loading, data, error, reload: () => setNonce((n) => n + 1) };
}
