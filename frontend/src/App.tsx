import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/layout/AppLayout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { DevicesPage } from "./pages/DevicesPage.js";
import { TemplatesPage } from "./pages/TemplatesPage.js";
import { ApiKeysPage } from "./pages/ApiKeysPage.js";
import { NewNotificationPage } from "./pages/NewNotificationPage.js";
import { DeviceRegistrationPage } from "./pages/DeviceRegistrationPage.js";
import { PairConfirmPage } from "./pages/PairConfirmPage.js";
import { getToken } from "./lib/auth.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pair/:code" element={<PairConfirmPage />} />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<NotificationsPage />} />
            <Route path="/notifications/new" element={<NewNotificationPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/:id/register" element={<DeviceRegistrationPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/api-keys" element={<ApiKeysPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
