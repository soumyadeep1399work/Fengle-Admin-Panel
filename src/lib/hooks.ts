import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useToast, errMsg } from '../components/ui';

type Query = Record<string, string | number | boolean | undefined>;

/**
 * Paged list endpoint that responds `{ [key]: T[], total? }`.
 * Falls back gracefully if the backend doesn't paginate yet (older routes).
 */
export function useList<T>(path: string, key: string, query: Query = {}, map?: (row: Record<string, unknown>) => T) {
  return useQuery({
    queryKey: [path, query],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>(path, query);
      const raw = (res[key] as Record<string, unknown>[] | undefined) ?? [];
      const rows = map ? raw.map(map) : (raw as T[]);
      const total = typeof res.total === 'number' ? res.total : undefined;
      return { rows, total };
    },
    placeholderData: keepPreviousData,
  });
}

export function useDetail<T>(path: string, key: string, enabled = true) {
  return useQuery({
    queryKey: [path],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>(path);
      return (res[key] ?? res) as T;
    },
    enabled,
  });
}

/** Mutation that toasts on success/failure and invalidates every query whose key starts with one of `invalidate`. */
export function useAction<V, R = unknown>(fn: (vars: V) => Promise<R>, opts: { success?: string; invalidate?: string[]; onDone?: () => void } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (opts.success) toast(opts.success);
      for (const prefix of opts.invalidate ?? []) {
        qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(prefix) });
      }
      opts.onDone?.();
    },
    onError: (e) => toast(errMsg(e), true),
  });
}
