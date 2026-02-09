import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { PageLoader } from "./components/PageLoader";
import { useAppInitialization } from "./hooks/useAppInitialization";
import { useAuthStore } from "./stores/authStore";
import { LoginPage } from "./pages/LoginPage";

// ── Lazy-loaded page components (route-based code splitting) ──────────
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const TasksPage = lazy(() =>
  import("./pages/TasksPage").then((m) => ({ default: m.TasksPage }))
);
const TimePage = lazy(() =>
  import("./pages/TimePage").then((m) => ({ default: m.TimePage }))
);
const InboxPage = lazy(() =>
  import("./pages/InboxPage").then((m) => ({ default: m.InboxPage }))
);
const ClientsPage = lazy(() =>
  import("./pages/ClientsPage").then((m) => ({ default: m.ClientsPage }))
);
const ProjectsPage = lazy(() =>
  import("./pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage }))
);
const ProjectDetailPage = lazy(() =>
  import("./pages/ProjectDetailPage").then((m) => ({
    default: m.ProjectDetailPage,
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const AccountingPage = lazy(() =>
  import("./pages/AccountingPage").then((m) => ({
    default: m.AccountingPage,
  }))
);
const PrdPage = lazy(() =>
  import("./pages/PrdPage").then((m) => ({ default: m.PrdPage }))
);
const PrdDetailPage = lazy(() =>
  import("./pages/PrdDetailPage").then((m) => ({ default: m.PrdDetailPage }))
);
const SecondBrainPage = lazy(() =>
  import("./pages/SecondBrainPage").then((m) => ({
    default: m.SecondBrainPage,
  }))
);
const SocialMediaPage = lazy(() =>
  import("./pages/SocialMediaPage").then((m) => ({
    default: m.SocialMediaPage,
  }))
);
// Accounting sub-pages
const InvoicesPage = lazy(() =>
  import("./pages/accounting/InvoicesPage").then((m) => ({
    default: m.InvoicesPage,
  }))
);
const IncomePage = lazy(() =>
  import("./pages/accounting/IncomePage").then((m) => ({
    default: m.IncomePage,
  }))
);
const ExpensesPage = lazy(() =>
  import("./pages/accounting/ExpensesPage").then((m) => ({
    default: m.ExpensesPage,
  }))
);
const AssetsPage = lazy(() =>
  import("./pages/accounting/AssetsPage").then((m) => ({
    default: m.AssetsPage,
  }))
);
const ReportsPage = lazy(() =>
  import("./pages/accounting/ReportsPage").then((m) => ({
    default: m.ReportsPage,
  }))
);

// James Brain sub-pages
const JamesBrainOverviewPage = lazy(() =>
  import("./pages/james-brain/OverviewPage").then((m) => ({
    default: m.OverviewPage,
  }))
);
const JamesBrainSuggestionsPage = lazy(() =>
  import("./pages/james-brain/SuggestionsPage").then((m) => ({
    default: m.SuggestionsPage,
  }))
);
const JamesBrainTasksPage = lazy(() =>
  import("./pages/james-brain/TasksPage").then((m) => ({
    default: m.TasksPage,
  }))
);
const JamesBrainActivityPage = lazy(() =>
  import("./pages/james-brain/ActivityPage").then((m) => ({
    default: m.ActivityPage,
  }))
);
const JamesBrainAutomationsPage = lazy(() =>
  import("./pages/james-brain/AutomationsPage").then((m) => ({
    default: m.AutomationsPage,
  }))
);
const JamesBrainUsagePage = lazy(() =>
  import("./pages/james-brain/UsagePage").then((m) => ({
    default: m.UsagePage,
  }))
);
const JamesBrainApiUsagePage = lazy(() =>
  import("./pages/james-brain/ApiUsagePage").then((m) => ({
    default: m.ApiUsagePage,
  }))
);

// Client portal (lazy — separate feature area)
const ClientLayout = lazy(() =>
  import("./features/client/components/ClientLayout").then((m) => ({
    default: m.ClientLayout,
  }))
);
const ClientLoginPage = lazy(() =>
  import("./features/client/pages/ClientLoginPage").then((m) => ({
    default: m.ClientLoginPage,
  }))
);
const ClientDashboard = lazy(() =>
  import("./features/client/pages/ClientDashboard").then((m) => ({
    default: m.ClientDashboard,
  }))
);
const ClientArchitecturePage = lazy(() =>
  import("./features/client/pages/ClientArchitecturePage").then((m) => ({
    default: m.ClientArchitecturePage,
  }))
);

// Lazy-load heavy shell components that aren't needed on every route
const QuickCaptureDialog = lazy(() =>
  import("./components/capture/QuickCaptureDialog").then((m) => ({
    default: m.QuickCaptureDialog,
  }))
);
const CommandPalette = lazy(() =>
  import("./components/CommandPalette").then((m) => ({
    default: m.CommandPalette,
  }))
);
const Confetti = lazy(() =>
  import("./components/ui/Confetti").then((m) => ({ default: m.Confetti }))
);

function App() {
  console.log("[App] Rendering App component...");
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Auth state - must verify first before initializing stores
  const {
    isAuthenticated,
    isLoading: authLoading,
    verifyToken,
  } = useAuthStore();

  // Verify token on mount (loads token from localStorage)
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // Only initialize stores AFTER auth is verified (so API calls have the token)
  // Pass isAuthenticated so stores only load when user is logged in
  const { isLoading, error } = useAppInitialization(
    isAuthenticated && !authLoading
  );

  console.log("[App] State:", {
    isLoading,
    error,
    isAuthenticated,
    authLoading,
  });

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in inputs (except for specific shortcuts)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Quick Capture: Cmd+Shift+Space (works everywhere)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === "Space") {
        e.preventDefault();
        setCaptureDialogOpen(true);
        return;
      }

      // Navigation shortcuts (don't trigger in inputs)
      if (isInput) return;

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            navigate("/");
            break;
          case "2":
            e.preventDefault();
            navigate("/tasks");
            break;
          case "3":
            e.preventDefault();
            navigate("/time");
            break;
          case "4":
            e.preventDefault();
            navigate("/projects");
            break;
          case "5":
            e.preventDefault();
            navigate("/clients");
            break;
          case "6":
            e.preventDefault();
            navigate("/accounting/invoices");
            break;
          case "7":
            e.preventDefault();
            navigate("/inbox");
            break;
          case ",":
            e.preventDefault();
            navigate("/settings");
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  // Show loading state during auth check or app initialization
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated (but allow client portal routes)
  const isClientRoute = window.location.pathname.startsWith("/client");
  if (!isAuthenticated && !isClientRoute) {
    return <LoginPage />;
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="text-destructive text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold">Failed to load application</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Redirect /login to / when authenticated */}
          <Route path="/login" element={<Navigate to="/" replace />} />

          {/* Client portal routes (separate from main app) */}
          <Route path="/client/login" element={<ClientLoginPage />} />
          <Route path="/client" element={<ClientLayout />}>
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="architecture" element={<ClientArchitecturePage />} />
          </Route>

          <Route
            element={
              <AppLayout
                onQuickCapture={() => setCaptureDialogOpen(true)}
              />
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/time" element={<TimePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            {/* Redirect legacy /invoices to /accounting/invoices */}
            <Route
              path="/invoices"
              element={<Navigate to="/accounting/invoices" replace />}
            />
            <Route path="/accounting" element={<AccountingPage />} />
            <Route path="/accounting/invoices" element={<InvoicesPage />} />
            <Route path="/accounting/income" element={<IncomePage />} />
            <Route path="/accounting/expenses" element={<ExpensesPage />} />
            <Route path="/accounting/assets" element={<AssetsPage />} />
            <Route path="/accounting/reports" element={<ReportsPage />} />
            <Route path="/prd" element={<PrdPage />} />
            <Route path="/prd/:id" element={<PrdDetailPage />} />
            <Route path="/second-brain" element={<SecondBrainPage />} />
            <Route path="/social-media" element={<SocialMediaPage />} />
            {/* James Brain routes */}
            <Route
              path="/james-brain"
              element={<JamesBrainOverviewPage />}
            />
            <Route
              path="/james-brain/suggestions"
              element={<JamesBrainSuggestionsPage />}
            />
            <Route
              path="/james-brain/tasks"
              element={<JamesBrainTasksPage />}
            />
            <Route
              path="/james-brain/activity"
              element={<JamesBrainActivityPage />}
            />
            <Route
              path="/james-brain/automations"
              element={<JamesBrainAutomationsPage />}
            />
            <Route
              path="/james-brain/usage"
              element={<JamesBrainUsagePage />}
            />
            <Route
              path="/james-brain/api-costs"
              element={<JamesBrainApiUsagePage />}
            />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        <QuickCaptureDialog
          open={captureDialogOpen}
          onOpenChange={setCaptureDialogOpen}
        />
        <CommandPalette onNewCapture={() => setCaptureDialogOpen(true)} />
        <Confetti />
      </Suspense>
      <Toaster richColors position="bottom-right" />
    </>
  );
}

export default App;
