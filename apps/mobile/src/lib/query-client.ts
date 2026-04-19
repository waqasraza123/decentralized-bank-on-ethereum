import {
  MutationCache,
  QueryCache,
  QueryClient
} from "@tanstack/react-query";
import { reportMobileQueryError } from "./observability";

function formatQueryKey(value: readonly unknown[]) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable-query-key]";
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      reportMobileQueryError(error, {
        queryKey: formatQueryKey(query.queryKey)
      });
    }
  }),
  mutationCache: new MutationCache({
    onError(error, variables, _context, mutation) {
      reportMobileQueryError(error, {
        mutationKey: formatQueryKey(mutation.options.mutationKey ?? []),
        variables
      });
    }
  }),
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});
