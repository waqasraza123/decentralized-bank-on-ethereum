import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Transactions from "./pages/Transactions";
import Wallet from "./pages/Wallet";
import Loans from "./pages/Loans";
import Profile from "./pages/Profile";
import Staking from "./pages/Staking";
import CreatePool from "./pages/CreatePool";
import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";
import ProtectedRoute from "@/components/routing/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/sign-in" element={<SignIn />} />
          <Route path="/auth/sign-up" element={<SignUp />} />

          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
          <Route path="/staking" element={<ProtectedRoute><Staking /></ProtectedRoute>} />
          <Route path="/create-pool" element={<ProtectedRoute><CreatePool /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
        <Sonner />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
