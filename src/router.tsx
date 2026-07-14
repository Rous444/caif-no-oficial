import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function handleAuthError(error: unknown) {
  if (typeof window !== "undefined" && error instanceof Error && error.message === "No autenticado") {
    import("@/lib/auth-client").then(({ authClient }) => {
      authClient.signOut().finally(() => {
        window.location.href = "/login";
      });
    });
  }
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleAuthError }),
    mutationCache: new MutationCache({ onError: handleAuthError }),
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
