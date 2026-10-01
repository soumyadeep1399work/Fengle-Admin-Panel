import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { Category } from '../api/types';

/** All categories (admin view incl. inactive; falls back to the public active list until /admin/categories ships). */
export function useAllCategories() {
  return useQuery({
    queryKey: ['/admin/categories', 'all'],
    queryFn: async () => {
      try {
        return (await api.get<{ categories: Category[] }>('/admin/categories')).categories;
      } catch (e) {
        if (!(e instanceof ApiError && e.notBuilt)) throw e;
        return (await api.get<{ categories: Category[] }>('/categories')).categories;
      }
    },
    staleTime: 60_000,
  });
}
