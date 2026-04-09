import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/routing/ProtectedRoute";
import { WebI18nProvider } from "@/i18n/provider";
import { useT } from "@/i18n/use-t";
import { routerFuture } from "@/lib/router-future";

const Index = lazy(() => import("./pages/Index"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Loans = lazy(() => import("./pages/Loans"));
const Profile = lazy(() => import("./pages/Profile"));
const Yield = lazy(() => import("./pages/Yield"));
const SignIn = lazy(() => import("./pages/auth/SignIn"));
const SignUp = lazy(() => import("./pages/auth/SignUp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div
        aria-busy="true"
        aria-live="polite"
        className="w-full max-w-sm rounded-3xl border border-border/70 bg-card/80 p-6 text-center shadow-sm backdrop-blur"
      >
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-muted" />
        <p className="mt-4 text-sm font-medium text-foreground">
          {t("app.loadingTitle")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("app.loadingDescription")}
        </p>
      </div>
    </div>
  );
};

const withRouteBoundary = (element: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

const App = () => (
  <WebI18nProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter future={routerFuture}>
          <Routes>
            <Route path="/auth/sign-in" element={withRouteBoundary(<SignIn />)} />
            <Route path="/auth/sign-up" element={withRouteBoundary(<SignUp />)} />

            <Route
              path="/"
              element={
                <ProtectedRoute>{withRouteBoundary(<Index />)}</ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>{withRouteBoundary(<Transactions />)}</ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>{withRouteBoundary(<Wallet />)}</ProtectedRoute>
              }
            />
            <Route
              path="/loans"
              element={
                <ProtectedRoute>{withRouteBoundary(<Loans />)}</ProtectedRoute>
              }
            />
            <Route
              path="/yield"
              element={
                <ProtectedRoute>{withRouteBoundary(<Yield />)}</ProtectedRoute>
              }
            />
            <Route
              path="/staking"
              element={
                <Navigate to="/yield" replace />
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>{withRouteBoundary(<Profile />)}</ProtectedRoute>
              }
            />
            <Route path="/create-pool" element={<Navigate to="/yield" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
          <Sonner />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </WebI18nProvider>
);

export default App;
