import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AppLayout } from "./components/layout/AppLayout";
import { QuickCaptureDialog } from "./components/capture/QuickCaptureDialog";
import { CommandPalette } from "./components/CommandPalette";
import { Confetti } from "./components/ui/Confetti";
import { useAppInitialization } from "./hooks/useAppInitialization";
import { useAuthStore } from "./stores/authStore";
import { LoginPage } from "./pages/LoginPage";

// Direct imports (removed lazy loading to fix navigation issues in Tauri)
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { TimePage } from "./pages/TimePage";
import { InboxPage } from "./pages/InboxPage";
import { ClientsPage } from "./pages/ClientsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountingPage } from "./pages/AccountingPage";
import { InvoicesPage } from "./pages/accounting/InvoicesPage";
import { IncomePage } from "./pages/accounting/IncomePage";
import { ExpensesPage } from "./pages/accounting/ExpensesPage";
import { AssetsPage } from "./pages/accounting/AssetsPage";
import { ReportsPage } from "./pages/accounting/ReportsPage";
import { PrdPage } from "./pages/PrdPage";
import { PrdDetailPage } from "./pages/PrdDetailPage";
import { SecondBrainPage } from "./pages/SecondBrainPage";
import { JamesBrainPage } from "./pages/JamesBrainPage";
import {
  OverviewPage as JamesBrainOverviewPage,
  SuggestionsPage as JamesBrainSuggestionsPage,
  TasksPage as JamesBrainTasksPage,
  ActivityPage as JamesBrainActivityPage,
  AutomationsPage as JamesBrainAutomationsPage,
} from "./pages/james-brain";

// Client portal imports
import { ClientLayout } from "./features/client/components/ClientLayout";
import { ClientLoginPage } from "./features/client/pages/ClientLoginPage";
import { ClientDashboard } from "./features/client/pages/ClientDashboard";

function App() {
  console.log("[App] Rendering App component...");
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { isLoading, error } = useAppInitialization();
  
  // Auth state
  const { isAuthenticated, isLoading: authLoading, verifyToken } = useAuthStore();
  
  // Verify token on mount
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);
  
  console.log("[App] State:", { isLoading, error, isAuthenticated, authLoading });

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

  // Show login page if not authenticated
  if (!isAuthenticated) {
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
      <Routes>
        {/* Client portal routes (separate from main app) */}
        <Route path="/client/login" element={<ClientLoginPage />} />
        <Route path="/client" element={<ClientLayout />}>
          <Route path="dashboard" element={<ClientDashboard />} />
        </Route>
        
        <Route element={<AppLayout onQuickCapture={() => setCaptureDialogOpen(true)} />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/time" element={<TimePage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          {/* Redirect legacy /invoices to /accounting/invoices */}
          <Route path="/invoices" element={<Navigate to="/accounting/invoices" replace />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/accounting/invoices" element={<InvoicesPage />} />
          <Route path="/accounting/income" element={<IncomePage />} />
          <Route path="/accounting/expenses" element={<ExpensesPage />} />
          <Route path="/accounting/assets" element={<AssetsPage />} />
          <Route path="/accounting/reports" element={<ReportsPage />} />
          <Route path="/prd" element={<PrdPage />} />
          <Route path="/prd/:id" element={<PrdDetailPage />} />
          <Route path="/second-brain" element={<SecondBrainPage />} />
          {/* James Brain routes */}
          <Route path="/james-brain" element={<JamesBrainOverviewPage />} />
          <Route path="/james-brain/suggestions" element={<JamesBrainSuggestionsPage />} />
          <Route path="/james-brain/tasks" element={<JamesBrainTasksPage />} />
          <Route path="/james-brain/activity" element={<JamesBrainActivityPage />} />
          <Route path="/james-brain/automations" element={<JamesBrainAutomationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <QuickCaptureDialog
        open={captureDialogOpen}
        onOpenChange={setCaptureDialogOpen}
      />
      <CommandPalette onNewCapture={() => setCaptureDialogOpen(true)} />
      <Toaster richColors position="bottom-right" />
      <Confetti />
    </>
  );
}

export default App;
