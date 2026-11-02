import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { ErrorBanner, Spinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import Dashboard from "./pages/Dashboard";

// Each route loads its own chunk, so the first paint only ships the dashboard.
const Login = lazy(() => import("./pages/Login"));
const SharedTrip = lazy(() => import("./pages/SharedTrip"));
const TripBuilder = lazy(() => import("./pages/TripBuilder"));
const TripView = lazy(() => import("./pages/TripView"));

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { loading, error } = useAuth();
  if (error) return <div className="mx-auto max-w-md p-8"><ErrorBanner>{error}</ErrorBanner></div>;
  if (loading) return <Spinner />;

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/shared/:token" element={<SharedTrip />} />
        <Route path="/login" element={<Login />} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="new" element={<TripBuilder />} />
          <Route path="trips/:id" element={<TripView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
